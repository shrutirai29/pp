# DealMind + IntentLock: Autonomous Deal Agent & PayPal Sandbox Security Gateway

> **Phase 5: PayPal Sandbox Integration with IntentLock-Enforced Checkout**  
> Built for the PayPal AI Commerce & Transaction Security Hackathon.

DealMind is an autonomous shopping and negotiation agent designed to evaluate real-time product offers, rank eligible merchant bids, and negotiate pricing and fulfillment terms on behalf of buyers. To ensure safety and compliance, DealMind is paired with **IntentLock™**—an independent, server-enforced transaction security gateway that audits the complete seller-approved final deal against the buyer's original non-negotiable intent before payment can be authorized.

In Phase 5, DealMind integrates **PayPal Sandbox Checkout** via the official PayPal Orders API v2, with backend-enforced IntentLock verification gates that cannot be bypassed by the client.

> [!IMPORTANT]
> **SANDBOX ENVIRONMENT NOTICE & PCI DISCLAIMER:**  
> This project is configured strictly for the **PayPal Sandbox** developer environment (`https://api-m.sandbox.paypal.com`). It does NOT handle real credit cards, process live payments, or establish PCI-DSS certification. Never enter real financial or production credentials.

---

## 1. Architecture Overview & IntentLock Gate

```
┌────────────────────────────────────────────────────────────────────────┐
│                        DealMind React 18 Frontend                      │
│   - Natural Language Buyer Criteria Capture                            │
│   - Autonomous Multi-Agent Negotiation Simulation                      │
│   - IntentLock Security Verdict & SHA-256 Fingerprint Display          │
│   - PayPal Sandbox Checkout Interface (Buttons & Modal)                │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ (REST API with x-user-id isolation)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Secure Express Backend (Node.js 24)                  │
│                                                                        │
│  ┌───────────────────────┐          ┌───────────────────────────────┐  │
│  │ IntentLock Policy     │          │ Cryptographic Integrity       │  │
│  │ Engine (9 Checks)     │          │ (SHA-256 Fingerprint + HMAC)  │  │
│  └───────────┬───────────┘          └───────────────┬───────────────┘  │
│              │                                      │                  │
│              └──────────────────┐ ┌─────────────────┘                  │
│                                 ▼ ▼                                    │
│                     ┌───────────────────────────┐                      │
│                     │ Dedicated Payment Service │                      │
│                     │ - Validates Deal & Report │                      │
│                     │ - Enforces Human Approval │                      │
│                     │ - Authoritative Amount    │                      │
│                     │ - Atomic Token Consume    │                      │
│                     └─────────────┬─────────────┘                      │
└───────────────────────────────────┼────────────────────────────────────┘
                                    │ (Server-to-Server REST v2)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       PayPal Sandbox Gateway API                       │
│   - OAuth 2.0 Token Generation (`/v1/oauth2/token`)                    │
│   - Orders API Order Creation (`/v2/checkout/orders`)                  │
│   - Orders API Server Capture (`/v2/checkout/orders/{id}/capture`)     │
│   - Idempotency & Reconciliation (`PayPal-Request-Id`)                 │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ (ACID WAL Persistence)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       SQLite Persistent Storage                        │
│   - deals (Intent & Final Contract JSON)                               │
│   - verification_reports (Fingerprints, Checks & Status)               │
│   - approvals (Approval State Machine, Token Hashes & 15m TTL)         │
│   - payments (Orders, Captures, Idempotency & State Machine)           │
│   - audit_events (Append-Only Cryptographic Event Log)                 │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Payment Sequence & Security Gates

```
Buyer             DealMind Frontend             Express Backend            IntentLock Engine         PayPal Sandbox API
  │                      │                             │                           │                         │
  │── 1. Request Deal ──►│                             │                           │                         │
  │   Negotiation        │                             │                           │                         │
  │                      │── 2. Run Autonomous Neg ───►│                           │                         │
  │                      │   (FinalDeal agreed)        │                           │                         │
  │                      │                             │── 3. Run Policy Checks ──►│                         │
  │                      │                             │◄─ 4. Report & Fingerprint─│                         │
  │                      │◄─ 5. Return Report ─────────│                           │                         │
  │                      │                             │                           │                         │
  │── 6. Explicit Human ─►│                             │                           │                         │
  │   Approval Request   │── 7. POST /deals/:id/approve│                           │                         │
  │                      │                             │── 8. Re-verify terms ────►│                         │
  │                      │                             │   (Issue HMAC token)      │                         │
  │                      │◄─ 9. Authorization Token ───│                           │                         │
  │                      │                             │                           │                         │
  │── 10. Click Checkout ─►│                             │                           │                         │
  │   (PayPal Sandbox)   │── 11. POST /deals/:id/checkout                          │                         │
  │                      │       (token supplied) ────►│                           │                         │
  │                      │                             │── 12. Enforce 7 Gates ───►│                         │
  │                      │                             │   (Status=APPROVED,       │                         │
  │                      │                             │    TTL valid, no tamper)  │                         │
  │                      │                             │                           │                         │
  │                      │                             │── 13. Create Order ────────────────────────────────►│
  │                      │                             │   (Authoritative amount)  │                         │
  │                      │                             │◄─ 14. Order ID (CREATED) ───────────────────────────│
  │                      │◄─ 15. Return Order ID ──────│                           │                         │
  │                      │                             │                           │                         │
  │── 16. Approve Modal ─►│                             │                           │                         │
  │   in PayPal UI       │── 17. POST /deals/:id/capture                           │                         │
  │                      │       (orderId) ───────────►│                           │                         │
  │                      │                             │── 18. Atomic lock state ─►│                         │
  │                      │                             │   (CAPTURE_PENDING)       │                         │
  │                      │                             │── 19. Capture Order ───────────────────────────────►│
  │                      │                             │◄─ 20. Capture COMPLETED ────────────────────────────│
  │                      │                             │── 21. Atomically consume token in SQLite ───────────│
  │                      │                             │── 22. Record immutable audit event ─────────────────│
  │                      │◄─ 23. Confirmed Outcome ────│                           │                         │
  │                      │                             │                           │                         │
  │◄─ 24. Show Confirmed ─│                             │                           │                         │
  │   Receipt & Capture  │                             │                           │                         │
```

---

## 3. IntentLock's Role in Payment Authorization

IntentLock enforces strict authorization invariants before any PayPal call can be initiated:

1. **Independent Verification Clearance:** The backend verifies that the deal holds a `VERIFIED` verification report from the server policy engine. Unverified or rejected deals are blocked (`HTTP 400`).
2. **Post-Verification Term Integrity:** The server re-computes the SHA-256 contract fingerprint over all security terms. If the merchant or client modified pricing, delivery, condition, warranty, or fees after verification, checkout is immediately blocked (`HTTP 400`).
3. **Explicit Human Approval Gate:** Autonomous buyer agents cannot approve transactions. A valid human approval record with status `APPROVED` must exist.
4. **Approval Expiration (15-Minute TTL):** Approvals automatically expire after 15 minutes. Expired approvals are transitioned to `EXPIRED` and cannot initiate payment.
5. **Authoritative Amount & Currency:** The amount and currency sent to PayPal are read strictly from the server-persisted contract record (`deal.finalDeal.totalPayable` and `deal.intent.currency`). Client-supplied amounts are ignored.
6. **Atomic Single-Use Token Consumption:** Upon successful capture, the authorization token is atomically marked `CONSUMED` in SQLite using conditional concurrency locks (`WHERE status = 'APPROVED'`).
7. **Replay & Double-Capture Guard:** A completed payment record prevents subsequent checkout requests for the same deal. Repeated capture requests return the existing completed receipt without duplicating capture calls to PayPal.
8. **Fail-Closed Offline Mode:** If the backend is unavailable or client fallback is active, payment operations fail closed immediately. Client-side simulation cannot authorize or create PayPal orders.

---

## 4. Payment State Machine

The SQLite `payments` table tracks transactions through a formal state machine:

| State | Description | Permitted Next States |
| :--- | :--- | :--- |
| `NOT_STARTED` | Initial pre-checkout state | `ORDER_CREATED` |
| `ORDER_CREATED` | Order created with PayPal Sandbox API; awaiting buyer confirmation | `BUYER_APPROVED`, `CANCELLED`, `FAILED` |
| `BUYER_APPROVED` | Buyer completed authentication in PayPal Sandbox interface | `CAPTURE_PENDING`, `CANCELLED` |
| `CAPTURE_PENDING` | Capture request in-flight to PayPal Orders API | `COMPLETED`, `FAILED`, `REQUIRES_RECONCILIATION` |
| `COMPLETED` | Funds captured; authorization token atomically consumed; final state | *(Terminal State)* |
| `FAILED` | PayPal reported a rejection or capture failure | `ORDER_CREATED` (Retry) |
| `CANCELLED` | Buyer cancelled or closed checkout modal | `ORDER_CREATED` (Retry) |
| `REQUIRES_RECONCILIATION` | Network interruption during capture; probed against PayPal before retry | `COMPLETED`, `FAILED` |

---

## 5. PayPal Sandbox Setup & Configuration

### Prerequisites:
1. Go to the [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/).
2. Under **Testing Tools > Sandbox Accounts**, ensure you have:
   - A **Business (Merchant) Account** (to receive payments).
   - A **Personal (Buyer) Account** (with test funds to simulate purchases).
3. Under **Apps & Credentials > Sandbox**, create or select an app to obtain:
   - **Client ID**
   - **Client Secret**

### Environment Configuration:

Create a `server/.env` file (copied from `server/.env.example`):

```bash
PORT=4000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
DATABASE_PATH=data/dealmind.sqlite
APPROVAL_VALIDITY_SECONDS=900
TOKEN_HMAC_SECRET=your_server_hmac_signing_secret_here

# PayPal Sandbox Configuration
PAYPAL_CLIENT_ID=your_sandbox_client_id_here
PAYPAL_CLIENT_SECRET=your_sandbox_client_secret_here
PAYPAL_ENV=sandbox
PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com
```

> [!CAUTION]
> Never commit `.env` files or secrets to source control. Both `.gitignore` and `server/.gitignore` are configured to prevent credential leaks.

---

## 6. API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Server health check and uptime probe |
| `GET` | `/api/config/paypal` | Safe public endpoint returning Sandbox Client ID and environment |
| `POST` | `/api/deals` | Register or sync deal intent and final deal parameters |
| `GET` | `/api/deals/:id` | Fetch deal details (enforces user ownership) |
| `POST` | `/api/deals/:id/verify` | Execute independent server-side IntentLock verification |
| `POST` | `/api/deals/:id/approval-request` | Create an approval request record with 15-minute TTL |
| `POST` | `/api/deals/:id/approve` | Explicit human purchase authorization (issues HMAC token) |
| `POST` | `/api/deals/:id/decline` | Explicit human decline of transaction terms |
| `POST` | `/api/deals/:id/checkout` | Create PayPal Sandbox order bound to approved deal terms |
| `POST` | `/api/deals/:id/capture` | Server capture of PayPal order; consumes authorization token |
| `GET` | `/api/deals/:id/payment` | Fetch persisted payment status and capture details |
| `POST` | `/api/deals/:id/cancel-payment` | Record buyer cancellation of checkout |
| `GET` | `/api/deals/:id/audit` | Fetch append-only audit trail records |

---

## 7. Running the Application Locally

```powershell
# 1. Install root & server dependencies
npm install
cd server && npm install && cd ..

# 2. Run all 98 automated unit and integration tests
npm test

# 3. Start the Express backend server (Port 4000)
npm run server

# 4. In a separate terminal, start the Vite frontend (Port 5173)
npm run dev
# Open http://localhost:5173
```

### Dedicated Commands:

```powershell
# Run backend security & PayPal test suites only
npm run server:test

# Compile backend TypeScript
npm run server:build

# Build both frontend and backend for production
npm run build:all
```

---

## 8. Automated Test Suite (98 Tests Passing)

The project includes **98 automated tests** covering all phases:

```
Test Files  5 passed (5)
Tests       98 passed (98)

✓ src/lib/__tests__/businessRules.test.ts (8 tests)
    Phase 1 hard constraint and ranking rules
✓ src/lib/__tests__/phase2Negotiation.test.ts (16 tests)
    Phase 2 multi-agent negotiation protocol, round pacing & concessions
✓ src/lib/__tests__/phase3SecurityGateway.test.ts (26 tests)
    Phase 3 client gateway, canonical serialization, SHA-256 fingerprinting
✓ server/tests/backendSecurity.test.ts (24 tests)
    Phase 4 SQLite persistence, server policy engine, HMAC tokens, atomic consumption
✓ server/tests/paypalCheckoutSecurity.test.ts (24 tests)
    Phase 5 PayPal Sandbox integration, security gates & state machine:
    ✓ 1. Checkout rejected for an unverified deal
    ✓ 2. Checkout rejected for a rejected deal
    ✓ 3. Checkout rejected without human approval
    ✓ 4. Checkout rejected after approval expires
    ✓ 5. Checkout rejected after approved deal is modified
    ✓ 6. Checkout rejected for another user's deal
    ✓ 7. Checkout rejected when authorization token is invalid
    ✓ 8. Public config endpoint returns safe client config without secrets
    ✓ 9. Sends authoritative server-persisted amount and currency to PayPal
    ✓ 10. Persists PayPal order ID and payment record in SQLite database
    ✓ 11. Capture rejected for an unrelated order ID
    ✓ 12. Capture rejected for another user's deal
    ✓ 13. Capture rejected if approval status was declined
    ✓ 14. Successful capture records COMPLETED status and consumes authorization
    ✓ 15. GET /api/deals/:id/payment returns accurate persisted payment state
    ✓ 16. Repeated capture requests do not duplicate capture (idempotency)
    ✓ 17. Network failure marks REQUIRES_RECONCILIATION and reconciles against PayPal
    ✓ 18. Cancelled checkout records CANCELLED state
    ✓ 19. Audit events are persisted for order creation and capture
    ✓ 20. Completed payment cannot create another checkout order for same deal
    ✓ 21. User cannot view another user's payment records
    ✓ 22. Missing or malformed PayPal configuration produces a safe error
    ✓ 23. HttpPayPalClient sanitizes client secrets from any error messages
    ✓ 24. Changing price after approval strictly invalidates approval and blocks checkout
```

---

## 9. Security Limitations & Production Readiness

While Phase 5 establishes complete server-side gate enforcement and PayPal Sandbox integration, the following requirements should be implemented before moving to production:

1. **Authentication Migration:** In production, replace `x-user-id` session bearer headers with signed JWTs (e.g. Auth0, Clerk, or OAuth 2.0 OIDC).
2. **PayPal Webhooks:** Integrate PayPal Webhooks (`CHECKOUT.ORDER.APPROVED`, `PAYMENT.CAPTURE.COMPLETED`) with signature verification (`PAYPAL-TRANSMISSION-SIG`) as a secondary reconciliation mechanism for asynchronous capture notifications.
3. **Hardware Security Modules (HSM):** Store HMAC signing keys and PayPal API secrets in a cloud secret manager (AWS KMS, GCP Secret Manager, or HashiCorp Vault) rather than environment variables.
4. **Database Clustering:** For production scale, transition the local SQLite database to a distributed Postgres cluster with read replicas and row-level security (RLS).
