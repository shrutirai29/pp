# DealMind + IntentLock: Demo Runbook & Judge Guide

This runbook provides complete instructions for running, testing, and presenting **DealMind + IntentLock** for the PayPal AI Hackathon.

---

## 1. System Architecture & Core Concept

**DealMind** is an autonomous multi-agent negotiation system where an AI Buyer Agent negotiates on behalf of a user against simulated or real Seller Agents within strict, user-authorized purchase boundaries.

**IntentLock** is an independent transaction security gateway that prevents AI hallucination, agent drift, and unauthorized payments. It enforces:
1. **Zero-Trust Verification**: Validates the final negotiated agreement directly against the user's initial purchase intent (budget ceiling, delivery window, warranty requirements).
2. **Cryptographic Fingerprinting**: Calculates a canonical SHA-256 hash of all agreed transaction terms (`dealFingerprint`).
3. **Explicit Human-in-the-Loop Approval**: Issues an HMAC-SHA256 signed approval token with a 15-minute expiration time-to-live (TTL).
4. **Single-Use Atomic Authorization**: Consumes the authorization token atomically in PayPal Sandbox checkout, permanently binding the PayPal Order ID to the IntentLock verification record.
5. **Tamper-Evident Audit Trail**: Persists an immutable hash-chained audit log of every event.

```
[ User Purchase Intent ]
          │
          ▼
[ Autonomous Negotiation ] ── (Buyer Agent ◄──► Seller Agent, up to 5 rounds)
          │
          ▼
  [ Final Agreement ]
          │
          ▼
[ IntentLock Gateway ] ── Independent Verification (Budget, Delivery, Warranty)
          │            ── Computes canonical SHA-256 Deal Fingerprint
          ▼
 [ Explicit Human Approval ] ── 15-minute TTL countdown, HMAC-SHA256 Signed Token
          │
          ▼
[ PayPal Sandbox Checkout ] ── Atomic Token Consumption, Exact Amount Binding
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

## 3. Environment Configuration

Create a `.env` file in the project root directory (or set environment variables in your runtime shell). **Never commit real credentials to version control.**

```bash
# Server Configuration
PORT=3001
NODE_ENV=development

# Security Secret (Used for IntentLock HMAC-SHA256 token signing)
# In production, provide a strong 64+ character random string
INTENTLOCK_HMAC_SECRET=development_hmac_secret_key_32_bytes_min_length_12345

# SQLite Database Location (defaults to :memory: if omitted)
SQLITE_DB_PATH=./server/dealmind.sqlite

# LLM Negotiation Configuration
# Supported providers: 'mock' (default, offline, zero-cost) or 'openai'
LLM_PROVIDER=mock
OPENAI_API_KEY=your_openai_api_key_here
LLM_MODEL=gpt-4o-mini
LLM_TIMEOUT_MS=8000
LLM_MAX_FALLBACKS=2

# PayPal Sandbox Configuration
# Supported environments: 'sandbox' or 'mock'
PAYPAL_ENV=sandbox
PAYPAL_CLIENT_ID=your_paypal_sandbox_client_id
PAYPAL_CLIENT_SECRET=your_paypal_sandbox_client_secret
PAYPAL_WEBHOOK_ID=your_paypal_sandbox_webhook_id
PAYPAL_RETURN_URL=http://localhost:5173/checkout/complete
PAYPAL_CANCEL_URL=http://localhost:5173/checkout/cancel
```

---

## 4. Quickstart Commands

### Step A: Install Dependencies
```bash
npm install
```

### Step B: Run Automated Tests
```bash
# Run all frontend and backend tests (131 tests)
npm test

# Run backend security and gateway tests only
npm run server:test
```

### Step C: Verify Builds
```bash
# Compiles both frontend (Vite) and backend (TypeScript)
npm run build:all
```

### Step D: Start Servers for Demo
Open two terminal windows:

**Terminal 1 (Backend API & Security Gateway):**
```bash
npm run server:start
# Output: [DealMind Server] listening on http://localhost:3001
```

**Terminal 2 (Frontend Client):**
```bash
npm run dev
# Output: Local: http://localhost:5173/
```

Access the application in your browser at `http://localhost:5173`.

---

## 5. Live Judge Walkthrough: Happy Path

Follow these steps to demonstrate the full end-to-end user journey:

1. **Set Purchase Intent**:
   - On the homepage, inspect the prefilled intent:
     - **Item**: DJI Mini 3 Pro Drone
     - **Max Budget**: ₹8,500
     - **Max Delivery**: 5 Days
     - **Min Warranty**: 12 Months
   - Click **"Find Best Deals"**.
   - Note that eligible offers are retrieved and ranked deterministically by the backend.

2. **Autonomous AI Negotiation**:
   - Select an eligible seller offer (e.g., *AeroTech Direct* at ₹9,200 asking price).
   - Click **"Start Autonomous Negotiation"**.
   - Observe the live dialogue indicator (`Autonomous Dialogue in Progress...`).
   - The Buyer Agent and Seller Agent exchange proposals across up to 5 rounds, negotiating price, shipping, and warranty.
   - The negotiation reaches agreement at ₹8,150 (within the user's ₹8,500 budget limit).

3. **IntentLock Independent Verification**:
   - The app transitions to the IntentLock security screen.
   - Click **"Verify Deal Terms"**.
   - IntentLock performs an out-of-band verification against the original user intent.
   - Note the green status badges:
     - Total Payable: ₹8,150 ≤ ₹8,500 (Compliant)
     - Delivery: 4 days ≤ 5 days (Compliant)
     - Warranty: 12 months ≥ 12 months (Compliant)
   - View the computed **Canonical SHA-256 Fingerprint** (`dealFingerprint`).

4. **Explicit Human Approval**:
   - The system displays the approval countdown timer (**15:00 TTL**).
   - Review the final terms: Price, Delivery, Warranty, and cryptographic hash.
   - Click **"Approve & Sign Authorization"**.
   - An HMAC-SHA256 signed `approvalToken` is generated and securely persisted.

5. **PayPal Sandbox Checkout**:
   - Click **"Pay with PayPal"**.
   - The server verifies that the approval token is valid, active, unexpired, and unused.
   - It creates an authorized PayPal order strictly for the verified amount (`8150.00 INR`).
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

### Failure Scenario 1: Budget Ceiling Breach (Agent Overspending Prevented)
1. In the Intent form, set **Max Budget** to **₹7,000**.
2. Select a seller offer whose rock-bottom floor price is ₹7,800.
3. Start negotiation. The seller agent refuses to drop below ₹7,800.
4. If a deal were forcibly submitted at ₹7,800, click **"Verify Deal"**.
5. **Result**: IntentLock blocks the transaction with `REJECTED`:
   ```
   "Independently verified total of ₹7,800 exceeds user authorized maximum budget ceiling of ₹7,000"
   ```
   *Payment authorization is completely inaccessible.*

### Failure Scenario 2: Post-Verification Deal Tampering (Cryptographic Tamper Resistance)
1. Verify a legitimate deal at ₹8,150.
2. In the browser console or via an API client (`curl`), attempt to submit a modified deal payload (e.g., price changed to ₹8,900) using the previously generated `dealId`.
3. **Result**: IntentLock recomputes the SHA-256 fingerprint:
   ```json
   {
     "error": "DEAL_FINGERPRINT_MISMATCH",
     "message": "Transaction rejected: Canonical fingerprint does not match approved deal terms."
   }
   ```
   *Any prior approval token is instantly invalidated (`REVOKED`).*

### Failure Scenario 3: Expired Authorization TTL
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

### Failure Scenario 4: Replay & Double-Spend Prevention
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
- **OpenAI Live Mode**: Set `LLM_PROVIDER=openai`, `OPENAI_API_KEY=sk-...`, `LLM_MODEL=gpt-4o-mini`. The buyer and seller agents make live LLM completion requests guarded by system prompts, schema validation, and fallback mechanisms.

### B. PayPal Payment Gateway
- **Mock Sandbox Mode**: Default when `PAYPAL_CLIENT_ID` is unset. Simulates the PayPal order lifecycle with real UUIDs, capture IDs, and HMAC validations.
- **Live PayPal Sandbox**: Set `PAYPAL_ENV=sandbox` with valid sandbox credentials from [developer.paypal.com](https://developer.paypal.com). Performs live HTTPS requests to `https://api-m.sandbox.paypal.com`.

---

## 8. Current Limitations & Production Roadmap

1. **Identity & Authentication Model (Header-Based Prototype)**:
   - User identity is extracted directly from the client-supplied `x-user-id` or `x-session-id` HTTP header (falling back to `dev-user-default` in development/test when omitted, and requiring the header in production).
   - **Explicit Limitation**: The application does *not* currently implement independently validated cryptographically signed sessions (such as JWTs or secure HTTP-only session cookies). Consequently, a client can impersonate another user ID simply by setting `x-user-id` or `x-session-id`.
   - **Implemented Ownership Protection**: Within the resolved user context (`req.user.id`), resource-level ownership validation is strictly and consistently enforced across all endpoints: deals, negotiations, IntentLock verifications, human approvals, PayPal checkout/capture, and audit log access all verify that `deal.userId === req.user.id` (returning HTTP 403 Forbidden on mismatch).
   - **Production Roadmap**: Production deployments require replacing the client-provided header mechanism with an external identity provider (IdP), OAuth2 / OpenID Connect, or cryptographically signed session cookies.
2. **Local Persistence**:
   - Utilizes native Node.js SQLite (`--experimental-sqlite`). In local demo environments, this creates a clean `./server/dealmind.sqlite` file.
   - *Production Roadmap*: PostgreSQL or CockroachDB with connection pooling for distributed enterprise deployment.
3. **Seller Agents**:
   - Sellers are currently simulated based on merchant catalog rules and discount curves.
   - *Production Roadmap*: Real-time webhooks or MCP (Model Context Protocol) connectors to Shopify, WooCommerce, and eBay APIs.

---

## 9. Test Verification Summary

The project includes 7 automated test suites verifying all layers of the architecture:

| Test Suite | Purpose | Tests |
|---|---|:---:|
| `businessRules.test.ts` | Intent validation, offer scoring, discount calculations | 8 |
| `phase2Negotiation.test.ts` | Multi-agent dialogue, counteroffer generation, concession logic | 16 |
| `phase3SecurityGateway.test.ts` | Canonical hashing, policy verification, replay prevention | 26 |
| `backendSecurity.test.ts` | Express middleware, IDOR protection, CSRF headers | 24 |
| `paypalCheckoutSecurity.test.ts` | Order creation, capture, amount matching, token consumption | 29 |
| `llmNegotiationSecurity.test.ts` | Prompt injection defense, schema enforcement, fallback logic | 20 |
| `endToEndDemoHardening.test.ts` | Full lifecycle, refresh recovery, tampering, timeout handling | 8 |
| **Total Passing Tests** | | **131** |
