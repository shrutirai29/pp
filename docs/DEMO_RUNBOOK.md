# DealMind + IntentLock: Demo Runbook & Judge Guide

This runbook provides complete instructions for running, testing, and presenting **DealMind + IntentLock** for the PayPal AI Hackathon.

---

## 1. System Architecture & Core Concept

**DealMind** is an autonomous multi-agent negotiation system where an AI Buyer Agent negotiates on behalf of a user against simulated or real Seller Agents within strict, user-authorized purchase boundaries.

**IntentLock** is an independent transaction security gateway that prevents AI hallucination, agent drift, and unauthorized payments. It enforces:
1. **Zero-Trust Verification**: Validates the final negotiated agreement directly against the user's initial purchase intent (budget ceiling, delivery window, warranty requirements).
2. **Cryptographic Fingerprinting**: Calculates a canonical SHA-256 hash of all agreed transaction terms (`dealFingerprint`).
3. **Explicit Human-in-the-Loop Approval**: Issues an HMAC-SHA256 signed approval token with a 15-minute expiration time-to-live (TTL).
4. **PayPal Currency Safety**: Strictly enforces supported PayPal REST API currencies (`USD`, `EUR`, `GBP`, etc.) without silent conversions or rate substitutions. Unsupported currencies (like `INR`) are rejected outright before order creation.
5. **Single-Use Atomic Authorization**: Consumes the authorization token atomically in PayPal Sandbox checkout, permanently binding the PayPal Order ID to the IntentLock verification record.
6. **Tamper-Evident Audit Trail**: Persists an immutable hash-chained audit log of every event.

```
[ User Purchase Intent (USD) ]
             │
             ▼
[ Autonomous Negotiation ] ── (Buyer Agent ◄──► Seller Agent, up to 5 rounds)
             │
             ▼
    [ Final Agreement ]
             │
             ▼
  [ IntentLock Gateway ] ── Independent Verification (Budget, Delivery, Warranty)
             │           ── Computes canonical SHA-256 Deal Fingerprint
             ▼
 [ Explicit Human Approval ] ── 15-minute TTL countdown, HMAC-SHA256 Signed Token
             │
             ▼
[ PayPal Sandbox Checkout ] ── Currency Allowlist, Atomic Consumption, Amount Binding
             │
             ▼
  [ Immutable Audit Trail ] ── Hash-chained tamper-evident event log
```

---

## 2. Runtime Requirements & Prerequisites

- **Node.js**: `v22.x` or higher (utilizes Node.js native `--experimental-sqlite` module).
- **Package Manager**: `npm` (bundled with Node.js).
- **Operating System**: Windows, macOS, or Linux.
- **Network**: Internet connection required for live PayPal Sandbox or live OpenAI API; zero network required when operating in Mock mode.

---

## 3. Environment Configuration & Variables

The backend reads its environment variables using `dotenv`. It automatically checks `server/.env` (when running via npm scripts inside the `server/` directory) as well as the repository root `.env`.

Create a `server/.env` file (or root `.env`) based on `server/.env.example`. **Never commit real credentials to version control.**

```bash
# Network & Runtime Configuration
PORT=4000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
DATABASE_PATH=data/dealmind.sqlite
APPROVAL_VALIDITY_SECONDS=900
TOKEN_HMAC_SECRET=dev_insecure_hmac_secret_for_demo_only

# PayPal Sandbox Configuration (Sandbox ONLY - Live PayPal is strictly prohibited)
PAYPAL_CLIENT_ID=your_sandbox_client_id_here
PAYPAL_CLIENT_SECRET=your_sandbox_client_secret_here
PAYPAL_ENV=sandbox
PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com

# LLM Provider Configuration
# Supported providers: 'mock' (default, offline, zero-cost) or 'openai' | 'anthropic' | 'gemini'
LLM_PROVIDER=mock
LLM_API_KEY=
LLM_MODEL=gpt-4o-mini
LLM_BASE_URL=
LLM_TIMEOUT_MS=15000
LLM_MAX_RETRIES=2
```

### Critical Security Configuration Rules:
1. **Sandbox-Only Guarantee**: `PAYPAL_ENV` must be `sandbox` and `PAYPAL_BASE_URL` must point to `https://api-m.sandbox.paypal.com`. Any attempt to configure a production PayPal URL (`api-m.paypal.com`) causes immediate startup termination.
2. **OpenAI Configuration**: For OpenAI live negotiation, set `LLM_PROVIDER=openai` and `LLM_API_KEY=your_key`. The key remains strictly backend-only.
3. **HMAC Signing Secret**: `TOKEN_HMAC_SECRET` signs human approval tokens using HMAC-SHA256. In production, provide a strong 64+ character random string.

---

## 4. Quickstart & Verification Commands

### Step A: Install Dependencies
```bash
npm install
```

### Step B: Run Safe Preflight Check
Verify all configurations, provider readiness, sandbox safety, and currency allowlists without creating any orders or capturing any payments:
```bash
npm run preflight
# or: npm run server:preflight
```
Alternatively, query the live backend preflight endpoint:
```bash
curl http://localhost:4000/api/preflight
```

### Step C: Run Automated Tests
```bash
# Run all frontend and backend tests
npm test

# Run backend security and gateway tests only
npm run server:test
```

### Step D: Verify Production Builds
```bash
# Compiles both frontend (Vite) and backend (TypeScript)
npm run build:all
```

### Step E: Start Servers for Demo
Open two terminal windows:

**Terminal 1 (Backend API & Security Gateway on port 4000):**
```bash
npm run server:start
# Output: [DealMind IntentLock Server] running on http://localhost:4000 (mode: development)
```

**Terminal 2 (Frontend Client on port 5173):**
```bash
npm run dev
# Output: Local: http://localhost:5173/
```

Access the application in your browser at `http://localhost:5173`.

---

## 5. Live Judge Walkthrough: Happy Path (USD)

Follow these steps to demonstrate the full end-to-end user journey:

1. **Set Purchase Intent**:
   - On the homepage, inspect the prefilled USD intent:
     - **Item**: 1TB NVMe M.2 SSD
     - **Max Budget**: $85.00 USD
     - **Max Delivery**: 3 Days
     - **Min Warranty**: 12 Months
     - **Currency**: `USD`
   - Click **"Find Best Deals"**.
   - Note that eligible offers are retrieved and ranked deterministically by the backend.

2. **Autonomous AI Negotiation**:
   - Select an eligible seller offer (*TechHaven Direct* at $74.00 asking price, or *Prime Storage Solutions* at $83.00 asking price).
   - Click **"Start Autonomous Negotiation"**.
   - Observe the live dialogue indicator (`Autonomous Dialogue in Progress...`).
   - The Buyer Agent and Seller Agent exchange proposals across up to 5 rounds, negotiating price, shipping waiver, and warranty.
   - The negotiation reaches agreement at **$68.00 USD** (within the user's $85.00 budget ceiling).

3. **IntentLock Independent Verification**:
   - The app transitions to the IntentLock security screen.
   - Click **"Verify Deal Terms"**.
   - IntentLock performs an out-of-band verification against the original user intent.
   - Note the green status badges:
     - Total Payable: $68.00 ≤ $85.00 (Compliant)
     - Delivery: 2 days ≤ 3 days (Compliant)
     - Warranty: 60 months ≥ 12 months (Compliant)
     - Currency: USD (Allowlisted for PayPal checkout)
   - View the computed **Canonical SHA-256 Fingerprint** (`dealFingerprint`).

4. **Explicit Human Approval**:
   - The system displays the approval countdown timer (**15:00 TTL**).
   - Review the final terms: Price, Delivery, Warranty, and cryptographic hash.
   - Click **"Approve & Sign Authorization"**.
   - An HMAC-SHA256 signed `approvalToken` is generated and securely persisted.

5. **PayPal Sandbox Checkout**:
   - Click **"Pay with PayPal"**.
   - The server verifies that the approval token is valid, active, unexpired, and unused.
   - It validates that `USD` is on the PayPal REST API allowlist.
   - It creates an authorized PayPal order strictly for the verified amount (`68.00 USD`).
   - The approval token is atomically consumed (`consumedAt` timestamp set).
   - The transaction transitions to `COMPLETED` with an assigned `paypalCaptureId`.

6. **Audit Trail Inspection**:
   - Navigate to the **Audit Timeline** tab.
   - Inspect the immutable event log:
     - `deal_verified`
     - `human_approval_granted`
     - `payment_authorization_created`
     - `paypal_payment_completed`
   - Every event includes a timestamp, actor, status, and payload hash.

---

## 6. Failure & Security Demonstration Scenarios

To prove that IntentLock is not mere "UI theater", present these failure demonstrations to the judges:

### Failure Scenario 1: PayPal Currency Safety & Unsupported Currency Rejection
1. If a deal is created with `currency: "INR"` (or any currency not on the PayPal REST API allowlist):
2. Click **"Verify Deal"** and attempt checkout.
3. **Result**: IntentLock and the PayPal payment service reject the transaction with HTTP 400:
   ```json
   {
     "error": "Currency 'INR' is not supported by PayPal. Checkout requires a supported currency (AUD, BRL, CAD, CNY, CZK, DKK, EUR, HKD, HUF, ILS, JPY, MYR, MXN, TWD, NZD, NOK, PHP, PLN, GBP, SGD, SEK, CHF, THB, USD)."
   }
   ```
   *No PayPal order is ever created, and zero silent substitutions to USD are permitted.*

### Failure Scenario 2: Budget Ceiling Breach (Agent Overspending Prevented)
1. In the Intent form, set **Max Budget** to **$60.00**.
2. Select a seller offer whose rock-bottom floor price is $66.00.
3. Start negotiation. The seller agent refuses to drop below $66.00.
4. If a deal is submitted at $66.00, click **"Verify Deal"**.
5. **Result**: IntentLock blocks the transaction with `REJECTED`:
   ```
   "Independently verified total of $66 exceeds user authorized maximum budget ceiling of $60"
   ```
   *Payment authorization is completely inaccessible.*

### Failure Scenario 3: Post-Verification Deal Tampering (Cryptographic Tamper Resistance)
1. Verify a legitimate deal at $68.00.
2. In the browser console or via an API client (`curl`), attempt to submit a modified deal payload (e.g., price changed to $75.00) using the previously generated `dealId`.
3. **Result**: IntentLock recomputes the SHA-256 fingerprint:
   ```json
   {
     "error": "DEAL_FINGERPRINT_MISMATCH",
     "message": "Transaction rejected: Canonical fingerprint does not match approved deal terms."
   }
   ```
   *Any prior approval token is instantly invalidated (`REVOKED`).*

### Failure Scenario 4: Expired Authorization TTL
1. Once approved, the approval token carries a strict 15-minute time-to-live (`expiresAt`).
2. If payment is attempted after expiration:
3. **Result**: PayPal order creation endpoint returns HTTP 400:
   ```json
   {
     "error": "APPROVAL_TOKEN_EXPIRED",
     "message": "Authorization token has expired. Please re-verify and approve the deal."
   }
   ```
   *No funds can ever be captured under an expired token.*

### Failure Scenario 5: Replay & Double-Spend Prevention
1. Complete a successful checkout.
2. Re-send the same checkout request with the already used `approvalToken`.
3. **Result**: The server rejects the request with HTTP 409 Conflict:
   ```json
   {
     "error": "TOKEN_ALREADY_CONSUMED",
     "message": "Authorization token has already been consumed. Replay attempt logged in audit trail."
   }
   ```

---

## 7. Switching Between Mock and Live Modes

### A. LLM Provider (Buyer & Seller Negotiation)
- **Mock Mode (Default)**: Set `LLM_PROVIDER=mock`. Uses deterministic state-machine agents with realistic concession curves. Fast, reliable, and zero cost.
- **OpenAI Live Mode**: Set `LLM_PROVIDER=openai`, `LLM_API_KEY=sk-...`, `LLM_MODEL=gpt-4o-mini`. The buyer and seller agents make live LLM completion requests guarded by system prompts, schema validation, and fallback mechanisms.

### B. PayPal Payment Gateway
- **Mock Sandbox Mode**: Default when `PAYPAL_CLIENT_ID` is unset. Simulates the PayPal order lifecycle with real UUIDs, capture IDs, and HMAC validations.
- **Live PayPal Sandbox**: Set `PAYPAL_ENV=sandbox`, `PAYPAL_CLIENT_ID`, and `PAYPAL_CLIENT_SECRET` with valid sandbox credentials from [developer.paypal.com](https://developer.paypal.com). Performs live HTTPS requests to `https://api-m.sandbox.paypal.com`.

---

## 8. Current Limitations & Production Roadmap

1. **Identity & Authentication Model (Header-Based Prototype)**:
   - User identity is extracted directly from the client-supplied `x-user-id` or `x-session-id` HTTP header (falling back to `dev-user-default` in development/test when omitted, and requiring the header in production).
   - **Explicit Limitation**: The application does *not* currently implement independently validated cryptographically signed sessions (such as JWTs or secure HTTP-only session cookies). Consequently, a client can impersonate another user ID simply by setting `x-user-id` or `x-session-id`.
   - **Implemented Ownership Protection**: Within the resolved user context (`req.user.id`), resource-level ownership validation is strictly and consistently enforced across all endpoints: deals, negotiations, IntentLock verifications, human approvals, PayPal checkout/capture, and audit log access all verify that `deal.userId === req.user.id` (returning HTTP 403 Forbidden on mismatch).
   - **Production Roadmap**: Production deployments require replacing the client-provided header mechanism with an external identity provider (IdP), OAuth2 / OpenID Connect, or cryptographically signed session cookies.
2. **Local Persistence**:
   - Utilizes native Node.js SQLite (`--experimental-sqlite`). In local demo environments, this creates a clean `./data/dealmind.sqlite` file.
   - *Production Roadmap*: PostgreSQL or CockroachDB with connection pooling for distributed enterprise deployment.
3. **Simulated Sellers**:
   - Sellers negotiate using private reservation prices and discount curves; live retail APIs are not called for seller catalog inventory.

---

## 9. Test Verification Summary

The project includes 7 automated test suites verifying all layers of the architecture:

| Test Suite | Purpose | Tests |
|---|---|:---:|
| `businessRules.test.ts` | Intent validation, offer scoring, discount calculations | 8 |
| `phase2Negotiation.test.ts` | Multi-agent dialogue, counteroffer generation, concession logic | 16 |
| `phase3SecurityGateway.test.ts` | Canonical hashing, policy verification, replay prevention | 26 |
| `backendSecurity.test.ts` | Express middleware, IDOR protection, CSRF headers | 24 |
| `paypalCheckoutSecurity.test.ts` | Order creation, capture, amount/currency matching, token consumption | 33 |
| `llmNegotiationSecurity.test.ts` | Prompt injection defense, schema enforcement, fallback logic | 20 |
| `endToEndDemoHardening.test.ts` | Full lifecycle, refresh recovery, tampering, timeout handling | 11 |
