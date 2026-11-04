import asyncio
import hashlib
import hmac
from datetime import datetime, timezone

import pytest
from fastapi import HTTPException

import payments


def test_mesomb_signature_matches_canonical_request(monkeypatch):
    class FixedDateTime(datetime):
        @classmethod
        def now(cls, tz=None):
            return cls(2026, 11, 4, 9, 0, 0, tzinfo=timezone.utc)

    monkeypatch.setattr(payments, "datetime", FixedDateTime)
    client = payments.MesombClient("app", "access", "secret")
    body = b'{"nonce":"n-123"}'
    headers = client._headers(
        "POST",
        "/api/v1.1/payment/collect/",
        "",
        body,
        "n-123",
    )

    signed_headers = (
        "content-type;host;x-mesomb-application;x-mesomb-date;x-mesomb-nonce"
    )
    canonical_headers = (
        "content-type:application/json\n"
        "host:mesomb.hachther.com\n"
        "x-mesomb-application:app\n"
        "x-mesomb-date:1793782800\n"
        "x-mesomb-nonce:n-123\n"
    )
    canonical_request = "\n".join(
        (
            "POST",
            "/api/v1.1/payment/collect/",
            "",
            canonical_headers,
            signed_headers,
            hashlib.sha1(body).hexdigest(),
        )
    )
    scope = "20261104/payment/mesomb_request"
    string_to_sign = "\n".join(
        (
            "HMAC-SHA1",
            "1793782800",
            scope,
            hashlib.sha1(canonical_request.encode()).hexdigest(),
        )
    )
    expected_signature = hmac.new(
        b"secret", string_to_sign.encode(), hashlib.sha1
    ).hexdigest()

    assert headers["Authorization"] == (
        "HMAC-SHA1 Credential=access/20261104/payment/mesomb_request, "
        f"SignedHeaders={signed_headers}, Signature={expected_signature}"
    )


def test_mesomb_http_errors_preserve_status_without_response_body(monkeypatch):
    response = payments.httpx.Response(
        401,
        request=payments.httpx.Request("POST", "https://mesomb.hachther.com/test"),
        text='{"detail":"sensitive provider response"}',
    )

    class FakeAsyncClient:
        def __init__(self, timeout):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, traceback):
            return False

        async def request(self, *args, **kwargs):
            response.raise_for_status()

    monkeypatch.setattr(payments.httpx, "AsyncClient", FakeAsyncClient)

    with pytest.raises(payments.MesombError) as error:
        asyncio.run(
            payments.MesombClient("app", "access", "secret").request(
                "POST", "/test", {"example": "value"}
            )
        )

    assert error.value.status_code == 401
    assert "sensitive provider response" not in str(error.value)


@pytest.mark.parametrize(
    ("phone", "expected"),
    [
        ("670000000", ("670000000", "+237670000000")),
        ("+237 670 000 000", ("670000000", "+237670000000")),
        ("00237670000000", ("670000000", "+237670000000")),
    ],
)
def test_normalize_cameroon_phone(phone, expected):
    assert payments.normalize_cameroon_phone(phone) == expected


@pytest.mark.parametrize("phone", ["67000000", "+237 550 000 000", "123456789"])
def test_reject_invalid_cameroon_phone(phone):
    with pytest.raises(HTTPException) as error:
        payments.normalize_cameroon_phone(phone)
    assert error.value.status_code == 422


def test_only_configured_plans_are_sellable():
    plan = {
        "_id": "offline_30d",
        "product_type": "offline_access",
        "name": "Offline access",
        "amount": 5000,
        "currency": "XAF",
        "duration_days": 30,
        "enabled": True,
    }

    assert payments.valid_plan(plan)
    assert not payments.valid_plan({**plan, "amount": None})
    assert not payments.valid_plan({**plan, "amount": True})
    assert not payments.valid_plan({**plan, "enabled": False})
    assert not payments.valid_plan({**plan, "duration_days": True})


def test_default_plans_are_seeded_without_overwriting_existing_settings():
    class PaymentPlansCollection:
        def __init__(self):
            self.documents = {
                "ai_tokens_10": {
                    "_id": "ai_tokens_10",
                    "enabled": False,
                    "amount": 700,
                }
            }

        async def update_one(self, query, update, upsert):
            self.documents.setdefault(query["_id"], update["$setOnInsert"])

    class Database:
        def __init__(self):
            self.payment_plans = PaymentPlansCollection()

    database = Database()
    asyncio.run(payments.seed_default_plans(database))

    token_plan = database.payment_plans.documents["ai_tokens_10"]
    offline_plan = database.payment_plans.documents["offline_access_60d"]
    assert token_plan["enabled"] is False
    assert token_plan["amount"] == 700
    assert payments.valid_plan(offline_plan)
    assert offline_plan["duration_days"] == 60
    assert offline_plan["amount"] == 1000


def test_transaction_must_match_order_amount_service_currency_and_reference():
    order = {
        "_id": "local-order",
        "external_reference": "local-order",
        "provider_reference": "provider-id",
        "payment_method": "mtn_momo",
        "product_snapshot": {"amount": 5000, "currency": "XAF"},
    }
    transaction = {
        "pk": "provider-id",
        "status": "SUCCESS",
        "type": "COLLECT",
        "amount": "5000.00",
        "currency": "XAF",
        "service": "MTN",
    }

    assert payments._transaction_matches(order, transaction)
    assert not payments._transaction_matches(order, {**transaction, "amount": 5001})
    assert not payments._transaction_matches(order, {**transaction, "service": "ORANGE"})
    assert not payments._transaction_matches(order, {**transaction, "pk": "other-id"})


def test_find_transaction_by_any_known_mesomb_reference():
    transaction = {
        "pk": "provider-id",
        "reference": "local-order",
        "status": "SUCCESS",
    }
    assert payments._find_transaction([transaction], "provider-id") == transaction
    assert payments._find_transaction([transaction], "local-order") == transaction
    assert payments._find_transaction([], "local-order") is None
