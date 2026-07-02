# NombaBooks — Agent Build Instructions

## What You Are Building
A production-grade middleware API that connects Nomba's payment infrastructure to Zoho Books. When a Zoho Books invoice is created, NombaBooks generates a Nomba checkout link. When the customer pays, Nomba fires a webhook, NombaBooks marks the invoice paid in Zoho Books. Refunds initiated either side sync automatically. There is also a React dashboard for merchant configuration and transaction monitoring.

---

## Constraints
- Backend: Node.js + Express only. No other runtime.
- Database: MongoDB via Mongoose.
- Frontend: React (Vite). Tailwind CSS only.
- No TypeScript. Plain JavaScript throughout.
- No ORM other than Mongoose.
- All secrets via environment variables. No hardcoded credentials anywhere.
- Every external API call must have explicit error handling. No silent failures.
- All Nomba webhook endpoints must validate the webhook signature before processing.
- All Zoho API calls must use auto-refreshed tokens. Never assume a token is valid.

---

## Project Structure
```
nombabooks/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── db.js                  # MongoDB connection
│   │   ├── middleware/
│   │   │   ├── errorHandler.js        # Global error handler
│   │   │   └── validateWebhook.js     # Nomba webhook signature validation
│   │   ├── models/
│   │   │   ├── Transaction.js         # Transaction mapping model
│   │   │   └── ZohoToken.js           # Zoho OAuth token storage
│   │   ├── routes/
│   │   │   ├── auth.js                # Zoho OAuth routes
│   │   │   ├── checkout.js            # Nomba checkout creation
│   │   │   ├── webhooks.js            # Nomba webhook receiver
│   │   │   ├── refunds.js             # Refund initiation
│   │   │   └── transactions.js        # Transaction listing for dashboard
│   │   ├── services/
│   │   │   ├── nomba.js               # All Nomba API calls
│   │   │   └── zoho.js                # All Zoho Books API calls
│   │   ├── queues/
│   │   │   └── retryQueue.js          # In-memory retry queue for failed API calls
│   │   └── index.js                   # Express app entry point
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── TransactionFeed.jsx
│   │   │   ├── WebhookLog.jsx
│   │   │   ├── RefundModal.jsx
│   │   │   └── ConnectZoho.jsx
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   └── Settings.jsx
│   │   ├── api/
│   │   │   └── client.js              # Axios instance pointing to backend
│   │   └── main.jsx
│   └── package.json
└── README.md
```

---

## Environment Variables

### Backend `.env.example`
```
# Nomba
NOMBA_CLIENT_ID=
NOMBA_CLIENT_SECRET=
NOMBA_ACCOUNT_ID=
NOMBA_BASE_URL=https://api.nomba.com
NOMBA_ENV=sandbox
NOMBA_WEBHOOK_SECRET=

# Zoho
ZOHO_CLIENT_ID=
ZOHO_CLIENT_SECRET=
ZOHO_REDIRECT_URI=http://localhost:3000/zoho/callback
ZOHO_ORGANIZATION_ID=

# MongoDB
MONGODB_URI=mongodb://localhost:27017/nombabooks

# App
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

**Rules:**
- When `NOMBA_ENV=sandbox`, the service must use `https://sandbox.nomba.com` as the base URL regardless of `NOMBA_BASE_URL`.
- When `NOMBA_ENV=production`, use `NOMBA_BASE_URL`.
- On startup, if `ZOHO_REFRESH_TOKEN` is missing from the database, log a clear message: `"Zoho not connected. Visit /zoho/auth to complete setup."` Do not crash.

---

## Database Models

### Transaction.js
```javascript
{
  nombaOrderReference: { type: String, required: true, unique: true }, // merchantTxRef
  zohoInvoiceId: { type: String, required: true },
  zohoInvoiceNumber: String,
  customerEmail: String,
  amount: { type: Number, required: true },
  currency: { type: String, default: 'NGN' },
  status: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  nombaTransactionId: String,
  refundId: String,
  webhookEvents: [{ event: String, receivedAt: Date, payload: Object }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}
```

### ZohoToken.js
```javascript
{
  accessToken: { type: String, required: true },
  refreshToken: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  organizationId: String,
  createdAt: { type: Date, default: Date.now }
}
```
Only one document should ever exist in this collection. On save, upsert — never insert a second record.

---

## Services

### `services/nomba.js`

Build the following functions. Every function must throw a descriptive error on failure — never return null silently.

**`getNombaToken()`**
- POST to `{baseUrl}/v1/auth/token/issue`
- Body: `{ client_id, client_secret }`
- Returns Bearer token string
- Cache the token in memory with its expiry time. Only re-fetch when expired.

**`createCheckoutOrder({ amount, customerEmail, invoiceId, callbackUrl })`**
- POST to `{baseUrl}/v1/checkout/order`
- Body:
```json
{
  "order": {
    "orderReference": "<uuid>",
    "callbackUrl": "<callbackUrl>",
    "customerEmail": "<customerEmail>",
    "amount": "<amount>",
    "currency": "NGN"
  }
}
```
- Returns `{ checkoutLink, orderReference }`

**`verifyTransaction(merchantTxRef)`**
- GET `{baseUrl}/v1/transactions/accounts?merchantTxRef={merchantTxRef}`
- Returns transaction status

**`initiateRefund({ transactionId, amount, reason })`**
- POST to the appropriate Nomba refund endpoint
- Returns refund confirmation object

**`transferToBank({ amount, accountNumber, bankCode, accountName, narration })`**
- POST to `{baseUrl}/v1/transfers/bank`
- Returns transfer result

---

### `services/zoho.js`

**`getValidAccessToken()`**
- Fetch the ZohoToken document from MongoDB
- If `expiresAt` is within 5 minutes, refresh the token automatically:
  - POST to `https://accounts.zoho.com/oauth/v2/token` with `grant_type=refresh_token`
  - Update the ZohoToken document with the new access token and new expiry
- Return the valid access token
- If no token document exists, throw: `"Zoho not connected. Complete OAuth setup first."`

**`getInvoice(invoiceId)`**
- GET `https://books.zoho.com/api/v3/invoices/{invoiceId}?organization_id={orgId}`
- Returns invoice object

**`createInvoice({ customerEmail, customerName, amount, description })`**
- Creates a contact if one doesn't exist for the email
- POST to `https://books.zoho.com/api/v3/invoices`
- Returns created invoice with `invoice_id`

**`markInvoicePaid({ invoiceId, amount, paymentDate, paymentMode, transactionId })`**
- POST to `https://books.zoho.com/api/v3/customerpayments`
- Body must include: `invoice_id`, `amount`, `payment_mode: "bank_transfer"`, `reference_number: transactionId`
- Returns payment record

**`createCreditNote({ invoiceId, amount, reason })`**
- POST to `https://books.zoho.com/api/v3/creditnotes`
- Used when a refund is processed
- Returns credit note object

---

## Routes

### `routes/auth.js`

**GET `/zoho/auth`**
- Redirect to Zoho OAuth authorization URL:
```
https://accounts.zoho.com/oauth/v2/auth?scope=ZohoBooks.fullaccess.all&client_id={ZOHO_CLIENT_ID}&response_type=code&redirect_uri={ZOHO_REDIRECT_URI}&access_type=offline
```

**GET `/zoho/callback`**
- Receive `code` from Zoho
- Exchange for access + refresh tokens via POST to `https://accounts.zoho.com/oauth/v2/token`
- Upsert the ZohoToken document in MongoDB
- Redirect to frontend dashboard with success flag

---

### `routes/checkout.js`

**POST `/api/checkout/create`**

Request body:
```json
{
  "zohoInvoiceId": "string",
  "customerEmail": "string",
  "amount": "number",
  "callbackUrl": "string"
}
```

Steps:
1. Validate all fields present
2. Call `createCheckoutOrder()`
3. Save a Transaction document with status `pending`
4. Return `{ checkoutLink, orderReference }`

Error cases to handle explicitly:
- Zoho invoice not found → 404
- Nomba API failure → 502 with Nomba's error message
- Missing fields → 400

---

### `routes/webhooks.js`

**POST `/api/webhooks/nomba`**

This is the most critical route. Build it in this exact order:

1. **Validate signature first, before anything else.**
   - Nomba sends a signature header. Verify it using `NOMBA_WEBHOOK_SECRET`.
   - If invalid → return 401 immediately. Log the attempt.

2. **Idempotency check.**
   - Extract `merchantTxRef` from the payload.
   - Check if a Transaction document with this reference already has this event recorded in `webhookEvents`.
   - If duplicate → return 200 immediately. Do not reprocess.

3. **Handle events:**

   **`checkout.completed` / payment success:**
   - Find Transaction by `nombaOrderReference`
   - Call `markInvoicePaid()` on Zoho Books
   - Update Transaction status to `paid`, set `nombaTransactionId`
   - Append event to `webhookEvents`

   **`checkout.failed` / payment failed:**
   - Find Transaction by `nombaOrderReference`
   - Update status to `failed`
   - Append event to `webhookEvents`

   **Unknown event type:**
   - Log it, return 200. Never return an error for unknown events — Nomba may retry.

4. **Always return 200 within 10 seconds.** If Zoho Books call is slow, push it to the retry queue and return 200 immediately.

---

### `routes/refunds.js`

**POST `/api/refunds/initiate`**

Request body:
```json
{
  "transactionId": "string",
  "reason": "string"
}
```

Steps:
1. Find Transaction document by `_id`
2. Verify status is `paid` — reject refund if not
3. Call `initiateRefund()` on Nomba
4. Call `createCreditNote()` on Zoho Books
5. Update Transaction status to `refunded`, store `refundId`
6. Return confirmation

Error cases:
- Transaction not found → 404
- Transaction not in `paid` status → 400 with message `"Only paid transactions can be refunded"`
- Nomba refund failure → 502, do not update Zoho or the Transaction record

---

### `routes/transactions.js`

**GET `/api/transactions`**
- Query params: `status`, `page` (default 1), `limit` (default 20)
- Returns paginated list of Transaction documents
- Sort by `createdAt` descending

**GET `/api/transactions/:id`**
- Returns single Transaction with full `webhookEvents` array

---

## Retry Queue — `queues/retryQueue.js`

Build a simple in-memory retry queue. Do not use Bull or Redis — keep it simple.

```javascript
// Interface the rest of the app uses:
retryQueue.add(async () => {
  await zoho.markInvoicePaid({ ... });
});
```

Rules:
- Max 3 retries per job
- Exponential backoff: 5s, 15s, 45s
- On final failure, log the error with full context so it's visible in Render logs
- Queue processes jobs sequentially, not concurrently

---

## Middleware

### `middleware/validateWebhook.js`
- Extract Nomba's signature from the request header
- Compute HMAC SHA-256 of the raw request body using `NOMBA_WEBHOOK_SECRET`
- Compare with the provided signature
- If mismatch, call `next({ status: 401, message: 'Invalid webhook signature' })`
- **Important:** Use `express.raw()` on the webhook route, not `express.json()` — you need the raw body for HMAC computation

### `middleware/errorHandler.js`
Global error handler. Must be the last middleware registered.
```javascript
(err, req, res, next) => {
  const status = err.status || 500;
  const message = err.message || 'Internal server error';
  console.error(`[${new Date().toISOString()}] ${status} - ${message}`);
  res.status(status).json({ error: message });
}
```

---

## Express App Setup — `index.js`

Register middleware and routes in this exact order:
1. `express.json()` for all routes except `/api/webhooks/nomba`
2. `express.raw({ type: 'application/json' })` for `/api/webhooks/nomba` only
3. CORS — allow `FRONTEND_URL` only
4. Routes: auth, checkout, webhooks, refunds, transactions
5. 404 handler for unmatched routes
6. Global error handler (last)

On startup:
- Connect to MongoDB
- Check for ZohoToken document — if missing, log the setup warning
- Log which Nomba environment is active (sandbox or production)

---

## Frontend — React Dashboard

### Pages

**Dashboard (`/`)**
- Shows `TransactionFeed` and `WebhookLog` side by side
- If Zoho is not connected, show a banner with a "Connect Zoho Books" button that hits `/zoho/auth`

**Settings (`/settings`)**
- Form to save Nomba API keys (Client ID, Client Secret, Account ID)
- POST to `/api/settings/nomba` — build this route if needed
- Zoho connection status with disconnect option

### Components

**TransactionFeed**
- Polls `GET /api/transactions` every 10 seconds
- Shows: order reference, customer email, amount, status (colored badge), date
- Each row has a "Refund" button — disabled unless status is `paid`
- Clicking Refund opens `RefundModal`

**RefundModal**
- Input for refund reason
- Confirm button POSTs to `/api/refunds/initiate`
- Shows success/error state inline

**WebhookLog**
- Polls `GET /api/transactions` and extracts `webhookEvents` from all transactions
- Shows: event type, transaction reference, timestamp
- Most recent first

**ConnectZoho**
- Button that redirects to `/zoho/auth`
- Shows connected status if ZohoToken exists (add a `GET /api/auth/zoho/status` route that returns `{ connected: boolean }`)

---

## Startup Validation Checklist

Before the app accepts requests, validate these on startup and log clearly if any are missing:
- `NOMBA_CLIENT_ID`
- `NOMBA_CLIENT_SECRET`
- `NOMBA_ACCOUNT_ID`
- `MONGODB_URI`
- `ZOHO_CLIENT_ID`
- `ZOHO_CLIENT_SECRET`
- `ZOHO_REDIRECT_URI`

Missing required env vars should log a warning but not crash — the app should still start so Zoho OAuth can be completed.

---

## What the Judges Will Check — Do Not Skip These

1. **Webhook signature validation** — if this is missing it is an automatic code quality failure
2. **Idempotent webhook processing** — send the same webhook twice, the invoice must not be marked paid twice
3. **Token auto-refresh** — Zoho access tokens expire in 1 hour. If the app breaks after 1 hour, it fails the reliability criterion
4. **Refund error handling** — attempting to refund a non-paid transaction must return a clear error, not a 500
5. **README** — must explain how to set up both API connections from scratch, what every env variable does, and how to test the full flow end to end

---

## API Endpoints Summary

| Method | Path | Description |
|--------|------|-------------|
| GET | `/zoho/auth` | Start Zoho OAuth flow |
| GET | `/zoho/callback` | Zoho OAuth callback |
| GET | `/api/auth/zoho/status` | Check if Zoho is connected |
| POST | `/api/checkout/create` | Create Nomba checkout for invoice |
| POST | `/api/webhooks/nomba` | Receive Nomba webhook events |
| POST | `/api/refunds/initiate` | Initiate refund |
| GET | `/api/transactions` | List transactions (paginated) |
| GET | `/api/transactions/:id` | Get single transaction |

---

## Definition of Done

The build is complete when:
- [ ] A Zoho Books invoice can be paid end-to-end via Nomba checkout in sandbox
- [ ] The webhook fires and Zoho Books marks the invoice paid automatically
- [ ] Sending the same webhook twice does not double-process
- [ ] A refund initiated via the dashboard updates both Nomba and Zoho Books
- [ ] A non-paid transaction cannot be refunded
- [ ] Zoho token refresh works silently after 1 hour without manual intervention
- [ ] The React dashboard shows live transaction status and webhook events
- [ ] All env vars are documented in `.env.example` with comments
- [ ] The app starts cleanly and logs its configuration state