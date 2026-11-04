import hashlib
import hmac
import json
import logging
import os
import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from typing import Any, Callable, Literal, Optional
from urllib.parse import quote, urlsplit

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from pymongo.errors import DuplicateKeyError


logger = logging.getLogger("gcsmart.payments")

MESOMB_API_URL = "https://mesomb.hachther.com"
PAYMENT_METHODS = {
    "mtn_momo": "MTN",
    "orange_money": "ORANGE",
}
FINAL_FAILURE_STATUSES = {"FAILED", "CANCELLED", "EXPIRED"}
FINAL_SUCCESS_STATUS = "SUCCESS"
DEFAULT_PLANS = (
    {
        "_id": "ai_tokens_10",
        "product_type": "ai_tokens",
        "name": "10 AI tokens",
        "description": "Add 10 AI tokens to your account.",
        "amount": 500,
        "currency": "XAF",
        "duration_days": None,
        "token_quantity": 10,
        "enabled": True,
    },
    {
        "_id": "offline_access_60d",
        "product_type": "offline_access",
        "name": "2-month offline access",
        "description": "Extend offline access for 60 days.",
        "amount": 1000,
        "currency": "XAF",
        "duration_days": 60,
        "token_quantity": None,
        "enabled": True,
    },
)


class MesombError(Exception):
    def __init__(self, message: str, status_code: Optional[int] = None):
        super().__init__(message)
        self.status_code = status_code


class MesombClient:
    def __init__(
        self,
        application_key: str,
        access_key: str,
        secret_key: str,
        base_url: str = MESOMB_API_URL,
    ):
        self.application_key = application_key
        self.access_key = access_key
        self.secret_key = secret_key
        self.base_url = base_url.rstrip("/")
        self.host = urlsplit(self.base_url).netloc

    def _headers(
        self, method: str, path: str, query: str, body: bytes, nonce: Optional[str]
    ) -> dict[str, str]:
        now = datetime.now(timezone.utc)
        timestamp = str(int(now.timestamp()))
        credential_date = now.strftime("%Y%m%d")
        headers = {
            "host": self.host,
            "x-mesomb-application": self.application_key,
            "x-mesomb-date": timestamp,
        }
        if nonce:
            headers["x-mesomb-nonce"] = nonce
        if method == "POST":
            headers["content-type"] = "application/json"

        signed_headers = ";".join(sorted(headers))
        canonical_headers = "".join(
            f"{name}:{headers[name].strip()}\n" for name in sorted(headers)
        )
        canonical_request = "\n".join(
            (
                method,
                path,
                query,
                canonical_headers,
                signed_headers,
                hashlib.sha1(body).hexdigest(),
            )
        )
        credential_scope = f"{credential_date}/payment/mesomb_request"
        string_to_sign = "\n".join(
            (
                "HMAC-SHA1",
                timestamp,
                credential_scope,
                hashlib.sha1(canonical_request.encode("utf-8")).hexdigest(),
            )
        )
        signature = hmac.new(
            self.secret_key.encode("utf-8"),
            string_to_sign.encode("utf-8"),
            hashlib.sha1,
        ).hexdigest()
        headers["Authorization"] = (
            f"HMAC-SHA1 Credential={self.access_key}/{credential_scope}, "
            f"SignedHeaders={signed_headers}, Signature={signature}"
        )
        return headers

    async def request(
        self, method: str, path: str, payload: Optional[dict] = None, params=None
    ) -> Any:
        body = (
            json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
            if payload is not None
            else b""
        )
        query_pairs = []
        if params:
            query_pairs = sorted(
                (str(key), str(value)) for key, value in params
            )
        canonical_query = "&".join(
            f"{quote(key, safe='~-._')}={quote(value, safe='~-._')}"
            for key, value in query_pairs
        )
        nonce = secrets.token_hex(16) if method == "POST" else None
        if nonce:
            payload = {**(payload or {}), "nonce": nonce}
            body = json.dumps(
                payload, separators=(",", ":"), ensure_ascii=False
            ).encode("utf-8")
        headers = self._headers(method, path, canonical_query, body, nonce)
        url = f"{self.base_url}{path}"
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                response = await client.request(
                    method,
                    url,
                    params=query_pairs or None,
                    content=body if method == "POST" else None,
                    headers=headers,
                )
                response.raise_for_status()
                return response.json()
        except httpx.HTTPStatusError as exc:
            status_code = exc.response.status_code
            logger.warning(
                "MeSomb returned HTTP %s for %s %s", status_code, method, path
            )
            raise MesombError("MeSomb rejected the request", status_code) from exc
        except httpx.RequestError as exc:
            logger.warning(
                "MeSomb transport failed for %s %s: %s",
                method,
                path,
                type(exc).__name__,
            )
            raise MesombError("Could not reach MeSomb") from exc
        except ValueError as exc:
            logger.warning("MeSomb returned invalid JSON for %s %s", method, path)
            raise MesombError("MeSomb returned an invalid response") from exc


def get_mesomb_client() -> Optional[MesombClient]:
    application_key = os.environ.get("MESOMB_APPLICATION_KEY", "").strip()
    access_key = os.environ.get("MESOMB_ACCESS_KEY", "").strip()
    secret_key = os.environ.get("MESOMB_SECRET_KEY", "").strip()
    if not (application_key and access_key and secret_key):
        return None
    return MesombClient(application_key, access_key, secret_key)


async def seed_default_plans(db) -> None:
    """Insert the confirmed launch plans without overwriting existing settings."""
    for plan in DEFAULT_PLANS:
        await db.payment_plans.update_one(
            {"_id": plan["_id"]},
            {"$setOnInsert": dict(plan)},
            upsert=True,
        )


def normalize_cameroon_phone(phone_number: str) -> tuple[str, str]:
    digits = re.sub(r"\D", "", phone_number)
    if digits.startswith("00237"):
        digits = digits[5:]
    elif digits.startswith("237") and len(digits) == 12:
        digits = digits[3:]
    if not re.fullmatch(r"6\d{8}", digits):
        raise HTTPException(
            status_code=422,
            detail="Enter a valid Cameroon mobile number, such as +237 6XX XXX XXX.",
        )
    return digits, f"+237{digits}"


def valid_plan(plan: dict) -> bool:
    if (
        not plan.get("enabled")
        or not isinstance(plan.get("name"), str)
        or not plan["name"].strip()
        or plan.get("currency") != "XAF"
        or not isinstance(plan.get("amount"), int)
        or isinstance(plan.get("amount"), bool)
        or plan["amount"] <= 0
    ):
        return False
    if plan.get("product_type") == "offline_access":
        days = plan.get("duration_days")
        return isinstance(days, int) and not isinstance(days, bool) and days > 0
    if plan.get("product_type") == "ai_tokens":
        quantity = plan.get("token_quantity")
        return (
            isinstance(quantity, int)
            and not isinstance(quantity, bool)
            and quantity > 0
        )
    return False


def _public_plan(plan: dict) -> dict:
    return {
        "id": plan["_id"],
        "product_type": plan["product_type"],
        "name": plan["name"],
        "description": plan.get("description", ""),
        "amount": plan["amount"],
        "currency": "XAF",
        "duration_days": plan.get("duration_days"),
        "token_quantity": plan.get("token_quantity"),
        "enabled": True,
    }


def _safe_order(order: dict) -> dict:
    result = {
        "order_id": order["_id"],
        "status": order["status"],
        "product": order["product_snapshot"],
        "payment_method": order["payment_method"],
        "created_at": order["created_at"],
        "updated_at": order["updated_at"],
        "paid_at": order.get("paid_at"),
    }
    if order["status"] == "failed":
        result["failure_message"] = "The payment was declined or expired. You can try again."
    return result


def _transaction_matches(order: dict, transaction: dict) -> bool:
    try:
        amount = Decimal(str(transaction.get("amount")))
    except (InvalidOperation, TypeError, ValueError):
        return False
    references = {
        str(value)
        for value in (
            transaction.get("pk"),
            transaction.get("trxID"),
            transaction.get("reference"),
        )
        if value is not None
    }
    expected_references = {
        str(value)
        for value in (
            order.get("provider_reference"),
            order.get("external_reference"),
            order.get("_id"),
        )
        if value is not None
    }
    return (
        amount == Decimal(order["product_snapshot"]["amount"])
        and transaction.get("currency") == order["product_snapshot"]["currency"]
        and transaction.get("service") == PAYMENT_METHODS[order["payment_method"]]
        and transaction.get("type") == "COLLECT"
        and bool(references.intersection(expected_references))
    )


async def _apply_verified_payment(db, order_id: str, transaction: dict) -> dict:
    paid_at = datetime.now(timezone.utc)
    async with await db.client.start_session() as session:
        async def apply_order(tx_session):
            order = await db.payment_orders.find_one(
                {"_id": order_id}, session=tx_session
            )
            if not order:
                raise HTTPException(status_code=404, detail="Payment order not found")
            if order["status"] == "paid":
                return order
            if not _transaction_matches(order, transaction):
                raise HTTPException(
                    status_code=409,
                    detail="The provider transaction does not match this order.",
                )

            snapshot = order["product_snapshot"]
            user_filter = {"user_id": order["user_id"]}
            if snapshot["product_type"] == "offline_access":
                user = await db.users.find_one(user_filter, session=tx_session)
                if not user:
                    raise HTTPException(status_code=404, detail="User account not found")
                existing_expiry = user.get("offline_access_until")
                if isinstance(existing_expiry, str):
                    try:
                        existing_expiry = datetime.fromisoformat(
                            existing_expiry.replace("Z", "+00:00")
                        )
                    except ValueError:
                        existing_expiry = None
                if not isinstance(existing_expiry, datetime):
                    existing_expiry = None
                if existing_expiry and existing_expiry.tzinfo is None:
                    existing_expiry = existing_expiry.replace(tzinfo=timezone.utc)
                starts_at = max(existing_expiry or paid_at, paid_at)
                expires_at = starts_at + timedelta(days=snapshot["duration_days"])
                update_result = await db.users.update_one(
                    user_filter,
                    {"$set": {"offline_access_until": expires_at}},
                    session=tx_session,
                )
                if update_result.matched_count != 1:
                    raise HTTPException(status_code=404, detail="User account not found")
                ledger = {
                    "duration_days": snapshot["duration_days"],
                    "token_quantity": None,
                    "starts_at": starts_at,
                    "expires_at": expires_at,
                }
            else:
                update_result = await db.users.update_one(
                    user_filter,
                    {"$inc": {"ai_tokens_remaining": snapshot["token_quantity"]}},
                    session=tx_session,
                )
                if update_result.matched_count != 1:
                    raise HTTPException(status_code=404, detail="User account not found")
                ledger = {
                    "duration_days": None,
                    "token_quantity": snapshot["token_quantity"],
                    "starts_at": paid_at,
                    "expires_at": None,
                }

            await db.entitlement_ledger.insert_one(
                {
                    "_id": str(uuid.uuid4()),
                    "user_id": order["user_id"],
                    "order_id": order_id,
                    "product_type": snapshot["product_type"],
                    "action": "grant",
                    "amount": snapshot["amount"],
                    "currency": snapshot["currency"],
                    **ledger,
                    "created_at": paid_at,
                },
                session=tx_session,
            )
            await db.payment_orders.update_one(
                {"_id": order_id, "status": {"$ne": "paid"}},
                {
                    "$set": {
                        "status": "paid",
                        "paid_at": paid_at,
                        "applied_at": paid_at,
                        "updated_at": paid_at,
                    }
                },
                session=tx_session,
            )
            return await db.payment_orders.find_one(
                {"_id": order_id}, session=tx_session
            )

        try:
            return await session.with_transaction(apply_order)
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Could not apply verified payment order %s", order_id)
            raise HTTPException(
                status_code=503,
                detail="Payment was confirmed but product delivery is delayed. Please check the order status again.",
            ) from exc


def configure(db, get_current_user: Callable):
    router = APIRouter(prefix="/api/payments", tags=["payments"])

    class CheckoutRequest(BaseModel):
        product_id: str = Field(min_length=1, max_length=100)
        payment_method: Literal["mtn_momo", "orange_money"]
        phone_number: str = Field(min_length=9, max_length=32)

    @router.get("/plans")
    async def list_plans(user: dict = Depends(get_current_user)):
        plans = await db.payment_plans.find({"enabled": True}).to_list(100)
        return {"plans": [_public_plan(plan) for plan in plans if valid_plan(plan)]}

    @router.post("/checkout", status_code=202)
    async def create_checkout(
        request: CheckoutRequest,
        idempotency_key: str = Header(alias="Idempotency-Key"),
        user: dict = Depends(get_current_user),
    ):
        if (
            not idempotency_key
            or len(idempotency_key) > 200
            or not idempotency_key.isprintable()
            or any(character.isspace() for character in idempotency_key)
        ):
            raise HTTPException(status_code=400, detail="Invalid Idempotency-Key header")
        local_phone, phone_e164 = normalize_cameroon_phone(request.phone_number)

        existing = await db.payment_orders.find_one(
            {"user_id": user["user_id"], "idempotency_key": idempotency_key}
        )
        if existing:
            if (
                existing["product_id"] != request.product_id
                or existing["payment_method"] != request.payment_method
                or existing["phone_e164"] != phone_e164
            ):
                raise HTTPException(
                    status_code=409,
                    detail="This idempotency key was already used for a different checkout.",
                )
            return _checkout_response(existing)

        plan = await db.payment_plans.find_one({"_id": request.product_id})
        if not plan or not valid_plan(plan):
            raise HTTPException(status_code=404, detail="Payment plan is not available")
        mesomb = get_mesomb_client()
        if not mesomb:
            raise HTTPException(
                status_code=503,
                detail="Mobile Money payments are not configured on the server.",
            )

        now = datetime.now(timezone.utc)
        order_id = str(uuid.uuid4())
        snapshot = {
            "name": plan["name"],
            "product_type": plan["product_type"],
            "amount": plan["amount"],
            "currency": "XAF",
            "duration_days": plan.get("duration_days"),
            "token_quantity": plan.get("token_quantity"),
        }
        order = {
            "_id": order_id,
            "user_id": user["user_id"],
            "product_id": plan["_id"],
            "product_type": plan["product_type"],
            "product_snapshot": snapshot,
            "provider": "mesomb",
            "payment_method": request.payment_method,
            "phone_e164": phone_e164,
            "status": "pending",
            "external_reference": order_id,
            "idempotency_key": idempotency_key,
            "created_at": now,
            "updated_at": now,
        }
        try:
            await db.payment_orders.insert_one(order)
        except DuplicateKeyError:
            existing = await db.payment_orders.find_one(
                {"user_id": user["user_id"], "idempotency_key": idempotency_key}
            )
            if existing and (
                existing["product_id"] == request.product_id
                and existing["payment_method"] == request.payment_method
                and existing["phone_e164"] == phone_e164
            ):
                return _checkout_response(existing)
            raise HTTPException(status_code=409, detail="Checkout request already exists")

        try:
            result = await mesomb.request(
                "POST",
                "/api/v1.1/payment/collect/",
                {
                    "payer": local_phone,
                    "amount": snapshot["amount"],
                    "service": PAYMENT_METHODS[request.payment_method],
                    "country": "CM",
                    "currency": "XAF",
                    "mode": "asynchronous",
                    "fees": True,
                    "trxID": order_id,
                    "reference": order_id,
                    "message": f"GC Sharp: {snapshot['name']}",
                },
            )
        except MesombError as exc:
            if (
                exc.status_code is not None
                and 400 <= exc.status_code < 500
                and exc.status_code not in {408, 429}
            ):
                await db.payment_orders.update_one(
                    {"_id": order_id, "status": "pending"},
                    {
                        "$set": {
                            "status": "failed",
                            "failure_code": "provider_rejected",
                            "provider_http_status": exc.status_code,
                            "updated_at": datetime.now(timezone.utc),
                        }
                    },
                )
                raise HTTPException(
                    status_code=502,
                    detail=(
                        f"MeSomb rejected the payment request (HTTP {exc.status_code}). "
                        "Check the backend credentials, enabled payment service, "
                        "and payment details."
                    ),
                ) from exc
            raise HTTPException(
                status_code=502,
                detail=(
                    "Could not confirm whether MeSomb received the payment request. "
                    "Check this order status before retrying."
                ),
            ) from exc

        if not isinstance(result, dict) or result.get("success") is not True:
            await db.payment_orders.update_one(
                {"_id": order_id, "status": "pending"},
                {
                    "$set": {
                        "status": "failed",
                        "failure_code": "provider_rejected",
                        "updated_at": datetime.now(timezone.utc),
                    }
                },
            )
            raise HTTPException(status_code=502, detail="The payment provider rejected the request.")

        transaction = result.get("transaction") or {}
        provider_id = transaction.get("pk")
        update = {
            "updated_at": datetime.now(timezone.utc),
            "provider_response_status": transaction.get("status"),
        }
        if provider_id:
            update["provider_reference"] = str(provider_id)
        await db.payment_orders.update_one(
            {"_id": order_id}, {"$set": update}
        )
        order.update(update)
        if transaction.get("status") == FINAL_SUCCESS_STATUS:
            order = await _apply_verified_payment(db, order_id, transaction)
        return _checkout_response(order)

    @router.get("/orders/{order_id}")
    async def get_order_status(
        order_id: str, user: dict = Depends(get_current_user)
    ):
        order = await db.payment_orders.find_one(
            {"_id": order_id, "user_id": user["user_id"]}
        )
        if not order:
            raise HTTPException(status_code=404, detail="Payment order not found")
        if order["status"] in {"pending", "processing"}:
            mesomb = get_mesomb_client()
            if not mesomb:
                raise HTTPException(
                    status_code=503,
                    detail="Payment status verification is not configured on the server.",
                )
            reference = order.get("provider_reference")
            source = "MESOMB" if reference else "EXTERNAL"
            transaction_id = reference or order["external_reference"]
            try:
                result = await mesomb.request(
                    "GET",
                    "/api/v1.1/payment/transactions/check/",
                    params=[("ids", transaction_id), ("source", source)],
                )
            except MesombError:
                raise HTTPException(
                    status_code=502,
                    detail="Could not verify the payment status. Please check again shortly.",
                )
            transaction = _find_transaction(result, transaction_id)
            if transaction:
                if not _transaction_matches(order, transaction):
                    logger.error("MeSomb transaction mismatch for order %s", order_id)
                    raise HTTPException(
                        status_code=409,
                        detail="Payment details could not be verified. Please contact support.",
                    )
                provider_status = str(transaction.get("status", "")).upper()
                if provider_status == FINAL_SUCCESS_STATUS:
                    order = await _apply_verified_payment(db, order_id, transaction)
                elif provider_status in FINAL_FAILURE_STATUSES:
                    await db.payment_orders.update_one(
                        {"_id": order_id, "status": {"$in": ["pending", "processing"]}},
                        {
                            "$set": {
                                "status": "failed",
                                "failure_code": provider_status.lower(),
                                "updated_at": datetime.now(timezone.utc),
                            }
                        },
                    )
                    order["status"] = "failed"
                elif provider_status in {"PENDING", "INITIATED", "PROCESSING"}:
                    order["status"] = "processing"
                    await db.payment_orders.update_one(
                        {"_id": order_id, "status": "pending"},
                        {
                            "$set": {
                                "status": "processing",
                                "updated_at": datetime.now(timezone.utc),
                            }
                        },
                    )
        return _safe_order(order)

    return router


def _find_transaction(result: Any, requested_id: str) -> Optional[dict]:
    if isinstance(result, dict):
        transactions = result.get("transactions")
        if isinstance(transactions, list):
            result = transactions
        else:
            result = [result]
    if not isinstance(result, list):
        return None
    for transaction in result:
        if not isinstance(transaction, dict):
            continue
        if requested_id in {
            str(transaction.get("pk", "")),
            str(transaction.get("trxID", "")),
            str(transaction.get("reference", "")),
        }:
            return transaction
    if len(result) == 1 and isinstance(result[0], dict):
        return result[0]
    return None


def _checkout_response(order: dict) -> dict:
    return {
        "order_id": order["_id"],
        "status": order["status"],
        "amount": order["product_snapshot"]["amount"],
        "currency": order["product_snapshot"]["currency"],
        "payment_method": order["payment_method"],
        "instructions": "Approve the payment request on your mobile phone. Payment is confirmed only after MeSomb verifies it.",
    }
