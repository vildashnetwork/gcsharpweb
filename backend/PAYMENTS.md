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

## Plans

The backend seeds the following confirmed plans into MongoDB's `payment_plans`
collection at startup. Seeding only inserts missing IDs, so it does not
overwrite existing plan customizations:

| Plan | Product | Price |
| --- | --- | ---: |
| 10 AI tokens | 10 tokens | 500 XAF |
| 2-month offline access | 60 days | 1,000 XAF |

Only enabled, correctly priced XAF plans are returned or accepted. Manage
future plan changes directly in the backend database; no public plan editing
endpoint is provided.

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

Before going live, configure valid MeSomb credentials on the backend, test MTN
and Orange with sandbox credentials, and verify settlement and fees with
MeSomb. Rotate any credential exposed outside the backend secret manager.
