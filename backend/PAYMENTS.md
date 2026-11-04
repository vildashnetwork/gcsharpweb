# MeSomb Mobile Money payments

The backend exposes authenticated payment APIs for Cameroon MTN Mobile Money
and Orange Money. MeSomb credentials must be configured as backend environment
variables only:

```dotenv
MESOMB_APPLICATION_KEY=
MESOMB_ACCESS_KEY=
MESOMB_SECRET_KEY=
```

Do not put these values in frontend configuration or commit real credentials.
If a credential has been shared in chat, rotate it in the MeSomb dashboard
before enabling payments.

## Plan setup

There are no launch prices in this repository. Plans are therefore not
automatically seeded or enabled. Add plans to the MongoDB `payment_plans`
collection only after confirming the product and its XAF price. For example:

```json
{
  "_id": "offline_30d",
  "product_type": "offline_access",
  "name": "30-day offline access",
  "description": "Offline access for 30 days.",
  "amount": 5000,
  "currency": "XAF",
  "duration_days": 30,
  "token_quantity": null,
  "enabled": true
}
```

The example amount is illustrative, not a GC Sharp price. AI-token plans use
`product_type: "ai_tokens"` and a positive `token_quantity` instead of
`duration_days`. Only enabled, correctly priced XAF plans are returned or
accepted. Manage plan changes directly in the backend database; no public plan
editing endpoint is provided.

## API

- `GET /api/payments/plans` — authenticated list of sellable plans.
- `POST /api/payments/checkout` — authenticated collection request. Send an
  `Idempotency-Key` header and `product_id`, `payment_method`
  (`mtn_momo` or `orange_money`), and `phone_number`. The backend looks up the
  price and sends an asynchronous MeSomb collection request.
- `GET /api/payments/orders/{order_id}` — authenticated status check. The
  backend checks the transaction directly with MeSomb and applies a verified
  entitlement once. A browser redirect or provider initiation response is not
  proof of payment.

MeSomb Mobile Money collection is a phone approval flow, not a hosted checkout
URL. The client should show the returned instructions and poll the order-status
endpoint until it reports `paid`, `failed`, or another final state. Do not
display success or grant a product based only on the initiation response.

The backend grants offline access by extending `users.offline_access_until`
and grants token bundles by incrementing `users.ai_tokens_remaining`. These
updates, the paid order state, and the entitlement ledger entry are committed
in a MongoDB transaction. Use a transaction-capable MongoDB deployment (such
as a replica set).

Before going live, test MTN and Orange with sandbox credentials and configured
test plans, verify settlement and fees with MeSomb, configure real prices, and
rotate any credential exposed outside the backend secret manager.
