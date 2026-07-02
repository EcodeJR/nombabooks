# NombaBooks — Payment Integration Middleware

A production-grade middleware connecting **Nomba's payment infrastructure** to **Zoho Books** with real-time invoice synchronization and automatic payment reconciliation.

## Overview

**NombaBooks** automates the complete payment workflow:

1. **Invoice Created in Zoho Books** → NombaBooks generates a Nomba checkout link
2. **Customer Pays via Nomba** → Checkout webhook fires
3. **Payment Verified** → Zoho Books invoice automatically marked as paid
4. **Refund Initiated** (either side) → Both systems synchronized automatically

**Includes:** React dashboard for merchant configuration and live transaction monitoring.

---

## Technology Stack

- **Backend:** Node.js + Express (no TypeScript)
- **Database:** MongoDB + Mongoose
- **Frontend:** React 18 + Vite + Tailwind CSS
- **APIs:** Nomba, Zoho Books OAuth 2.0

---

## Prerequisites

- **Node.js** 18+ (`node -v`)
- **MongoDB** running locally or remote connection string
- **Nomba Account** with API credentials (sandbox or production)
- **Zoho Books Account** with OAuth app registered

---

## Project Structure

```
nombabooks/
├── backend/                    # Node.js + Express backend
│   ├── src/
│   │   ├── config/db.js       # MongoDB connection
│   │   ├── middleware/        # Error handling, webhook validation
│   │   ├── models/            # Transaction, ZohoToken schemas
│   │   ├── routes/            # OAuth, checkout, webhooks, refunds, transactions
│   │   ├── services/          # Nomba & Zoho API integrations
│   │   ├── queues/            # Retry queue for failed operations
│   │   └── index.js           # Express app entry point
│   ├── .env.example           # Environment variables template
│   └── package.json
│
├── frontend/                  # React dashboard
│   ├── src/
│   │   ├── api/              # Axios client
│   │   ├── components/       # Dashboard UI components
│   │   ├── pages/            # Dashboard & Settings pages
│   │   ├── App.jsx           # Main app component
│   │   ├── main.jsx          # React entry point
│   │   └── index.css         # Tailwind styles
│   ├── index.html            # Vite entry point
│   ├── vite.config.js        # Vite configuration
│   ├── tailwind.config.js    # Tailwind CSS configuration
│   ├── .env.example          # Frontend env variables
│   └── package.json
│
├── build.md                  # Specification & constraints
└── README.md                 # This file
```

---

## Setup Instructions

### 1. Clone & Install

```bash
cd nombabooks/backend
npm install

cd ../frontend
npm install
```

### 2. Backend Configuration

#### Create `.env` file from template:

```bash
cd backend
cp .env.example .env
```

#### Fill in the required variables:

```env
# Nomba
NOMBA_CLIENT_ID=your_nomba_client_id
NOMBA_CLIENT_SECRET=your_nomba_client_secret
NOMBA_ACCOUNT_ID=your_nomba_account_id
NOMBA_ENV=sandbox                    # or 'production'
NOMBA_WEBHOOK_SECRET=your_webhook_secret

# Zoho
ZOHO_CLIENT_ID=your_zoho_client_id
ZOHO_CLIENT_SECRET=your_zoho_client_secret
ZOHO_REDIRECT_URI=http://localhost:3000/zoho/callback
ZOHO_ORGANIZATION_ID=your_zoho_org_id

# MongoDB
MONGODB_URI=mongodb://localhost:27017/nombabooks

# Application
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

#### Get Your Credentials

**Nomba:**
- Go to [Nomba Dashboard](https://dashboard.nomba.com)
- Navigate to **Settings > API Keys**
- Copy Client ID, Client Secret, and Account ID
- Create a webhook secret (any random string for now)

**Zoho Books:**
- Go to [Zoho Developer Console](https://accounts.zoho.com/developerconsole)
- Create a new **OAuth 2.0 application**
- Set Redirect URL: `http://localhost:3000/zoho/callback`
- Copy Client ID and Client Secret

**MongoDB:**
- Local: `mongodb://localhost:27017/nombabooks`
- Cloud (MongoDB Atlas): Get connection string from dashboard

### 3. Start MongoDB

**Local MongoDB:**

```bash
# macOS (Homebrew)
brew services start mongodb-community

# Linux
sudo systemctl start mongod

# Windows
# Use MongoDB Compass or Atlas Cloud
```

### 4. Start Backend

```bash
cd backend
npm run dev          # Watch mode
# or
npm start            # Production mode
```

**Expected output:**
```
[Startup] ✓ Nomba environment: sandbox
[Startup] ✓ Zoho token found
========================================
✓ NombaBooks Backend Server Ready
  Port: 3000
  Environment: development
========================================
```

### 5. Start Frontend

```bash
cd frontend
npm run dev
```

Opens at `http://localhost:5173`

### 6. Complete Zoho OAuth Setup

1. Visit **http://localhost:5173**
2. Click **"Connect Zoho Books"** button
3. Authorize the app in the Zoho popup
4. You'll be redirected back with connection confirmed

---

## Environment Variables Reference

### Backend `.env`

| Variable | Purpose | Example |
|----------|---------|---------|
| `NOMBA_CLIENT_ID` | Nomba API authentication | `your_client_id` |
| `NOMBA_CLIENT_SECRET` | Nomba API authentication | `your_client_secret` |
| `NOMBA_ACCOUNT_ID` | Your Nomba account | `123456789` |
| `NOMBA_ENV` | Sandbox or production | `sandbox` or `production` |
| `NOMBA_WEBHOOK_SECRET` | Webhook signature validation | `random_secret_key` |
| `ZOHO_CLIENT_ID` | Zoho OAuth client | `your_zoho_client_id` |
| `ZOHO_CLIENT_SECRET` | Zoho OAuth secret | `your_zoho_client_secret` |
| `ZOHO_REDIRECT_URI` | OAuth callback URL | `http://localhost:3000/zoho/callback` |
| `ZOHO_ORGANIZATION_ID` | Your Zoho organization | `123456789` |
| `MONGODB_URI` | MongoDB connection | `mongodb://localhost:27017/nombabooks` |
| `PORT` | Backend server port | `3000` |
| `NODE_ENV` | Environment | `development` or `production` |
| `FRONTEND_URL` | Frontend address | `http://localhost:5173` |

### Frontend `.env`

| Variable | Purpose | Example |
|----------|---------|---------|
| `VITE_API_URL` | Backend API URL | `http://localhost:3000` |

---

## API Endpoints

### Authentication

| Method | Path | Description |
|--------|------|-------------|
| GET | `/zoho/auth` | Start Zoho OAuth flow |
| GET | `/zoho/callback` | Zoho OAuth callback handler |
| GET | `/api/auth/zoho/status` | Check Zoho connection status |

### Checkout & Transactions

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/checkout/create` | Create Nomba checkout for invoice |
| GET | `/api/transactions` | List transactions (paginated) |
| GET | `/api/transactions/:id` | Get single transaction details |

### Webhooks

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/webhooks/nomba` | Receive Nomba payment webhooks |

### Refunds

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/refunds/initiate` | Initiate refund for paid transaction |

---

## Testing the Complete Flow

### Step 1: Create a Test Invoice in Zoho

1. Log in to Zoho Books
2. Create a new invoice
3. Note the invoice ID

### Step 2: Create Nomba Checkout

```bash
curl -X POST http://localhost:3000/api/checkout/create \
  -H "Content-Type: application/json" \
  -d '{
    "zohoInvoiceId": "123456789",
    "customerEmail": "customer@example.com",
    "amount": 10000,
    "callbackUrl": "http://localhost:5173/callback"
  }'
```

**Response:**
```json
{
  "checkoutLink": "https://checkout.nomba.com/...",
  "orderReference": "uuid-xxx-xxx"
}
```

### Step 3: Complete Payment (Sandbox)

1. Visit the `checkoutLink`
2. Use Nomba sandbox test card: `5555 5555 5555 4444` (expires `12/25`, CVV `123`)
3. Complete payment

### Step 4: Verify Webhook Processing

1. Check NombaBooks dashboard — transaction should show `paid`
2. Check Zoho Books — invoice should be marked as paid automatically
3. Check backend logs for webhook event processing

### Step 5: Test Refund

1. On dashboard, click refund button on a paid transaction
2. Enter refund reason
3. Confirm
4. Zoho Books should have a credit note created
5. Transaction status should change to `refunded`

---

## Key Features & Security

### ✓ Webhook Signature Validation
- All Nomba webhooks validated with `HMAC-SHA256`
- Invalid signatures rejected immediately (401)
- Prevents unauthorized requests

### ✓ Idempotent Webhook Processing
- Duplicate webhook events detected and ignored
- Send the same webhook twice → processed only once
- Safe against network retries

### ✓ Auto-Refreshing OAuth Tokens
- Zoho access tokens auto-refresh before expiry
- No manual intervention after 1 hour
- Seamless operation

### ✓ Retry Queue for Failures
- Failed API calls automatically retried with exponential backoff
- 5s → 15s → 45s delays between attempts
- Failed jobs logged with full context

### ✓ Explicit Error Handling
- Every external API call has error handling
- No silent failures
- Descriptive error messages

### ✓ Environment Isolation
- Sandbox vs production via `NOMBA_ENV`
- Separate database per environment
- Secrets via `.env`, never hardcoded

---

## Troubleshooting

### "Zoho not connected. Visit /zoho/auth to complete setup."

**Problem:** Zoho token not found in database  
**Solution:**
1. Click "Connect Zoho Books" on dashboard
2. Complete OAuth flow
3. Check that `ZOHO_REDIRECT_URI` matches exactly

### "Failed to get Nomba token"

**Problem:** Invalid Nomba credentials  
**Solution:**
1. Verify `NOMBA_CLIENT_ID` and `NOMBA_CLIENT_SECRET` in `.env`
2. Check if using sandbox: `NOMBA_ENV=sandbox`
3. Test credentials at Nomba Dashboard

### "Invalid webhook signature"

**Problem:** Webhook validation failed  
**Solution:**
1. Verify `NOMBA_WEBHOOK_SECRET` is correct
2. Check backend logs for signature mismatch details
3. Ensure webhook endpoint is publicly accessible

### MongoDB Connection Error

**Problem:** Cannot connect to MongoDB  
**Solution:**
```bash
# Check if running locally
mongod --version

# Or use MongoDB Atlas
# Update MONGODB_URI in .env with Atlas connection string
```

### Frontend Cannot Reach Backend

**Problem:** API calls fail with CORS error  
**Solution:**
1. Verify backend is running on port 3000
2. Check `FRONTEND_URL` in backend `.env` matches frontend address
3. Update `VITE_API_URL` in frontend `.env` if backend URL changed

---

## Production Deployment

### Backend (Render, Railway, Heroku)

1. Set `NODE_ENV=production`
2. Configure environment variables on platform
3. Set `NOMBA_ENV=production` for production Nomba keys
4. Use managed MongoDB (Atlas) or platform database
5. Set `FRONTEND_URL` to production frontend URL

### Frontend (Vercel, Netlify)

1. Build: `npm run build`
2. Deploy `dist/` folder
3. Set `VITE_API_URL` to production backend URL
4. Configure environment variables on platform

---

## Definition of Done ✓

- ✅ Zoho invoice can be paid end-to-end via Nomba checkout
- ✅ Webhook fires and Zoho marks invoice paid automatically
- ✅ Same webhook sent twice does not double-process
- ✅ Refund initiated via dashboard updates both Nomba and Zoho
- ✅ Non-paid transactions cannot be refunded
- ✅ Zoho token auto-refreshes after 1 hour without manual intervention
- ✅ React dashboard shows live transaction status and webhook events
- ✅ All env vars documented with comments
- ✅ App starts cleanly and logs its configuration state
- ✅ Code is clean, well-structured, and production-safe

---

## Support & Debugging

### View Backend Logs

```bash
# Real-time logs
npm run dev

# Production logs (Render/Railway/Heroku)
# Platform-specific: check dashboard
```

### Database Inspection

```bash
# MongoDB CLI
mongo mongodb://localhost:27017/nombabooks

# View transactions
db.transactions.find()

# View Zoho token
db.zohozokens.findOne()
```

### API Testing

```bash
# Test backend health
curl http://localhost:3000/health

# Test Zoho connection
curl http://localhost:3000/api/auth/zoho/status

# View transactions
curl http://localhost:3000/api/transactions
```

---

## License

Proprietary — NombaBooks Integration System

---

**Built by EcodeJR with ❤️ for seamless payment reconciliation**
