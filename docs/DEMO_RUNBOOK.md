# DealMind + IntentLock: Demo Runbook & Evaluation Guide

This runbook provides complete instructions for running, testing, and presenting **DealMind + IntentLock** for the PayPal AI Commerce & Transaction Security Hackathon.

---

## 1. System Architecture & Core Concept

**DealMind** is an autonomous multi-agent negotiation system where an AI Buyer Agent negotiates on behalf of a user against simulated or real Seller Agents within strict, user-authorized purchase boundaries.

**IntentLock™** is an independent, server-enforced transaction security gateway that prevents AI agent drift, prompt injection exploits, and unauthorized payments. It enforces:

1. **Zero-Trust Verification**: Audits the seller-accepted final agreement directly against the user's initial purchase intent (budget ceiling, delivery window, warranty requirements, no hidden subscriptions, and fee itemization).
2. **Cryptographic Fingerprinting**: Calculates a canonical SHA-256 hash of all agreed transaction terms (`dealFingerprint`).
3. **Explicit Human-in-the-Loop Approval**: Issues an HMAC-SHA256 signed single-use authorization token with an approval countdown time-to-live (TTL).
4. **PayPal Currency Safety**: Strictly enforces supported PayPal REST API currencies (`USD`, `EUR`, `GBP`, etc.) without silent conversions or rate substitutions. Unsupported currencies (like `INR`) are rejected outright before order creation.
5. **Single-Use Atomic Authorization**: Consumes the authorization token atomically in PayPal Sandbox checkout, permanently binding the PayPal Order ID and Capture ID to the IntentLock verification record.
6. **Tamper-Evident Audit Trail**: Persists an immutable hash-chained audit log of every event.

```
[ User Purchase Intent (USD) ]
             │
             ▼
[ Autonomous Negotiation ] ◄──► (Buyer Agent ◄──► Seller Agent, Groq LLM / Heuristics)
             │
             ▼
    [ Final Agreement ]
             │
             ▼
  [ IntentLock Gateway ] ───► Independent 9-Criteria Audit (Budget, Delivery, Warranty...)
             │           ───► Computes canonical SHA-256 Contract Fingerprint
             ▼
 [ Explicit Human Approval ] ───► 15-minute TTL, HMAC-SHA256 Signed Authorization Token
             │
             ▼
[ PayPal Sandbox Checkout ] ───► Currency Allowlist, Return/Cancel URLs, Order Creation
             │
             ▼
[ Authoritative Server Capture ] ───► PayPal Capture API, Atomic Single-Use Token Consumption
             │
             ▼
  [ Immutable Audit Trail ] ───► Tamper-evident event log persisted in SQLite
```

---

## 2. Verified Live Transaction Reference

The end-to-end payment lifecycle has been verified against PayPal Sandbox:

| Parameter | Authoritative Value |
|---|---|
| **Product** | Samsung 980 1TB PCIe 3.0 NVMe M.2 Internal SSD |
| **Seller** | TechHaven Direct |
| **Deal ID** | `intent_1793891217448` |
| **Buyer Budget Ceiling** | `$85.00 USD` |
| **Agreed Total Payable** | `$74.00 USD` |
| **Delivery Estimate** | 2 Days (Free Delivery) |
| **Warranty** | 60 Months Official Manufacturer Warranty |
| **IntentLock Status** | `VERIFIED` (9/9 criteria passed) |
| **Contract Fingerprint** | `bcceecd365a58b4354218991e2f405a9b5d0e2aaa4134cef74129cd02460f2de` |
| **PayPal Order ID** | `7M922293E62170201` |
| **PayPal Capture ID** | `12P5471025765970Y` |
| **PayPal Order Status** | `COMPLETED` |
| **Capture Status** | `COMPLETED` (`final_capture: true`) |
| **Captured Amount** | `$74.00 USD` (Gross: `$74.00`, Fee: `$3.76`, Net: `$70.24`) |
| **Authorization Status** | `CONSUMED` |
| **Local Payment Status** | `COMPLETED` |
| **Deal Status** | `payment_completed` |

---

## 3. Runtime Requirements & Prerequisites

- **Node.js**: `v22.x` or `v24.x` (utilizes Node.js native `--experimental-sqlite` module).
- **Package Manager**: `npm` (v10+).
- **Operating System**: Windows, macOS, or Linux.
- **Network**: Internet connection required for live PayPal Sandbox or Groq LLM API; zero external network required when operating in Mock mode.

---

## 4. Environment Configuration & Variables

The backend reads its environment variables using `dotenv`. Create a `server/.env` file based on `server/.env.example`.

> [!CAUTION]
> **Never commit real credentials, API keys, or secrets to version control.**

```bash
# Network & Runtime Configuration
PORT=4000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
DATABASE_PATH=data/dealmind.sqlite
APPROVAL_VALIDITY_SECONDS=900
TOKEN_HMAC_SECRET=dev_insecure_hmac_secret_for_demo_only_min_32_chars

# PayPal Sandbox Configuration (Sandbox ONLY - Live PayPal is strictly prohibited)
PAYPAL_CLIENT_ID=your_sandbox_client_id_here
PAYPAL_CLIENT_SECRET=your_sandbox_client_secret_here
PAYPAL_ENV=sandbox
PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com
PAYPAL_RETURN_URL=http://localhost:5173/verification?paypal=return
PAYPAL_CANCEL_URL=http://localhost:5173/verification?paypal=cancel

# LLM Provider Configuration
# Supported providers: 'mock' (default, offline, zero-cost) or 'groq' | 'openai' | 'anthropic' | 'gemini'
LLM_PROVIDER=mock
LLM_API_KEY=
LLM_MODEL=openai/gpt-oss-120b
LLM_BASE_URL=
LLM_TIMEOUT_MS=15000
LLM_MAX_RETRIES=2
```

### Critical Security Configuration Rules:
1. **Sandbox-Only Guarantee**: `PAYPAL_ENV` must be `sandbox` and `PAYPAL_BASE_URL` must point to `https://api-m.sandbox.paypal.com`. Any attempt to configure a production PayPal URL (`api-m.paypal.com`) causes immediate startup termination.
2. **Groq / OpenAI Configuration**: For live LLM negotiation, set `LLM_PROVIDER=groq` and `LLM_API_KEY=your_key` with model `openai/gpt-oss-120b`. The API key remains strictly backend-only.
3. **HMAC Signing Secret**: `TOKEN_HMAC_SECRET` signs human approval tokens and session tokens using HMAC-SHA256.
4. **PayPal Return & Cancel URLs**: Wired into the PayPal order creation `application_context` to prevent hosted checkout redirect failures.

---

## 5. Quickstart & Verification Commands

### Step A: Install Dependencies
```bash
# Install root and frontend dependencies
npm install

# Install server dependencies
npm --prefix server install
```

### Step B: Run Safe Preflight Check
Verify all configurations, provider readiness, sandbox safety, and currency allowlists without creating orders or capturing payments:
```bash
npm --prefix server run preflight
```
Alternatively, query the live backend preflight endpoint:
```bash
curl http://localhost:4000/api/preflight
```

### Step C: Run Automated Tests
```bash
# Run backend test suite (128 tests across 6 suites)
npm --prefix server test

# Run full workspace test suite (182 tests across 10 suites)
npm test
```

### Step D: Verify Production Builds
```bash
# Compiles backend TypeScript
npm --prefix server run build

# Compiles frontend Vite + TypeScript
npm run build
```

### Step E: Start Servers for Demo
Open two terminal windows:

**Terminal 1 (Backend API & Security Gateway on port 4000):**
```bash
npm --prefix server run dev
# Output: [DealMind IntentLock Server] running on http://localhost:4000 (mode: development)
```

**Terminal 2 (Frontend Client on port 5173):**
```bash
npm run dev
# Output: Local: http://localhost:5173/
```

Access the application in your browser at `http://localhost:5173`.

---

## 6. Live Judge Walkthrough: Happy Path ($74.00 USD)

Follow these steps to demonstrate the full end-to-end user journey:

1. **Set Purchase Intent**:
   - On the left sidebar navigation, click **"Find a Deal"** or click **"Find My Deal →"** in the hero.
   - Inspect the prefilled USD intent:
     - **Item**: 1TB NVMe M.2 SSD
     - **Max Budget**: $85.00 USD
     - **Max Delivery**: 3 Days
     - **Min Warranty**: 12 Months
     - **Condition**: New
     - **Subscriptions**: Prohibited
     - **Currency**: `USD`
   - Click **"Find Best Deals"**.
   - Note that eligible offers are retrieved and ranked deterministically by the backend.

2. **Autonomous AI Negotiation**:
   - Select the eligible seller offer (*TechHaven Direct* with asking price $74.00 USD).
   - Click **"Start Autonomous Negotiation"**.
   - Observe the live dialogue indicator (`Autonomous Dialogue in Progress...`).
   - The Buyer Agent and Seller Agent exchange proposals across negotiation rounds, validating price, delivery speed, and warranty.
   - The negotiation reaches agreement at **$74.00 USD** (within the user's $85.00 budget ceiling, 2-day delivery, 60-month warranty).

3. **IntentLock Independent Verification**:
   - The app transitions to the IntentLock security screen.
   - Click **"Proceed to IntentLock Verification"**.
   - IntentLock independently audits all 9 criteria against original user intent:
     - Check 1: Transaction Status & Bilateral Acceptance (PASSED)
     - Check 2: Transaction Currency Invariance (`USD == USD`, PASSED)
     - Check 3: Product Identity & Integrity (PASSED)
     - Check 4: Hardware Condition Verification (New, PASSED)
     - Check 5: Independent Budget & Total Payability Audit ($74.00 ≤ $85.00, PASSED)
     - Check 6: Fulfillment & Delivery Window (2 days ≤ 3 days, PASSED)
     - Check 7: Hidden Recurring Charges & Subscription Mandates (Zero subscriptions, PASSED)
     - Check 8: Ancillary Fee Disclosure & Itemization (PASSED)
     - Check 9: Warranty Coverage & Hardware Protection (60 mos ≥ 12 mos, PASSED)
   - View the computed **Canonical SHA-256 Fingerprint**:
     `bcceecd365a58b4354218991e2f405a9b5d0e2aaa4134cef74129cd02460f2de`

4. **Explicit Human Approval**:
   - The system displays the human approval countdown timer (**15:00 TTL**).
   - Review the final terms: Price, Delivery, Warranty, and cryptographic fingerprint.
   - Click **"Approve & Sign Authorization"**.
   - An HMAC-SHA256 signed `authorizationToken` is generated and securely registered in SQLite (`status: APPROVED`, `consumed_at: NULL`).

5. **PayPal Sandbox Checkout & Authoritative Capture**:
   - Click **"Pay with PayPal"**.
   - The server verifies that the approval token is valid, active, unexpired, and unused.
   - It creates a PayPal Sandbox order bound to contract fingerprint (`7M922293E62170201` for `$74.00 USD`).
   - Buyer completes approval in PayPal Sandbox hosted checkout.
   - Backend performs authoritative server-side capture via `/api/deals/:id/capture`.
   - The capture is validated: amount `$74.00`, currency `USD`, capture ID `12P5471025765970Y`.
   - The authorization token is atomically transitioned to `CONSUMED`.
   - The transaction transitions to `COMPLETED` and deal status to `payment_completed`.

6. **Audit Trail Inspection**:
   - Navigate to the **Audit Trail** tab in the sidebar.
   - Inspect the immutable event log:
     - `requirements_created`
     - `offers_compared`
     - `negotiation_started`
     - `counteroffer_received`
     - `verification_completed`
     - `fingerprint_generated`
     - `human_approval_requested`
     - `approval_granted`
     - `paypal_order_created`
     - `paypal_payment_completed`
   - Every event includes a timestamp, actor, status, and payload details.

---

## 7. Failure & Security Demonstration Scenarios

To prove that IntentLock is not mere "UI theater", present these failure demonstrations to the judges:

### Failure Scenario 1: PayPal Currency Safety & Unsupported Currency Rejection
1. If a deal is initiated with `currency: "INR"` (or any currency not on the PayPal REST API allowlist):
2. Click **"Verify Deal"** and attempt checkout.
3. **Result**: IntentLock and the payment service reject the transaction with HTTP 400:
   ```json
   {
     "error": "Currency 'INR' is not supported by PayPal. Checkout requires a supported currency (AUD, BRL, CAD, CNY, CZK, DKK, EUR, HKD, HUF, ILS, JPY, MYR, MXN, TWD, NZD, NOK, PHP, PLN, GBP, SGD, SEK, CHF, THB, USD)."
   }
   ```
   *No PayPal order is ever created, and zero silent substitutions to USD are permitted.*

### Failure Scenario 2: Budget Ceiling Breach (Agent Overspending Prevented)
1. In the Intent form, set **Max Budget** to **$60.00**.
2. Select a seller offer whose floor price is $74.00.
3. Start negotiation. The seller agent refuses to drop below $74.00.
4. If a deal is submitted at $74.00, click **"Verify Deal"**.
5. **Result**: IntentLock blocks the transaction with `REJECTED`:
   *Payment authorization is completely inaccessible.*

### Failure Scenario 3: Post-Verification Deal Tampering (Cryptographic Tamper Resistance)
1. Verify a legitimate deal at $74.00.
2. In an API client (`curl`), attempt to submit a modified deal payload (e.g., price changed to $80.00) using the previously generated `dealId`.
3. **Result**: IntentLock recomputes the SHA-256 fingerprint:
   ```json
   {
     "error": "DEAL_FINGERPRINT_MISMATCH",
     "message": "Transaction rejected: Canonical fingerprint does not match approved deal terms."
   }
   ```
   *Any prior approval token is instantly invalidated (`INVALIDATED`).*

### Failure Scenario 4: Expired Authorization TTL
1. Once approved, the approval token carries a strict 15-minute time-to-live (`expiresAt`).
2. If checkout initiation is attempted after expiration:
3. **Result**: PayPal order creation endpoint returns HTTP 400:
   ```json
   {
     "error": "Human approval has expired. Re-verification required."
   }
   ```
   *No checkout can be initiated under an expired token.*

### Failure Scenario 5: Replay & Double-Spend Prevention
1. Complete a successful checkout and capture.
2. Re-send the checkout or capture request with the already used authorization token or order.
3. **Result**: The server returns the cached completion without creating duplicate orders or captures:
   ```json
   {
     "success": true,
     "data": {
       "status": "COMPLETED",
       "message": "Payment was already captured and completed."
     }
   }
   ```

---

## 8. Switching Between Mock and Live Modes

### A. LLM Provider (Buyer & Seller Negotiation)
- **Mock Mode (Default)**: Set `LLM_PROVIDER=mock`. Uses deterministic rule-based agents. Fast, reliable, and zero cost.
- **Groq Live Mode**: Set `LLM_PROVIDER=groq`, `LLM_API_KEY=gsk_...`, `LLM_MODEL=openai/gpt-oss-120b`. The buyer and seller agents make live LLM completion requests guarded by system prompts, schema validation, and fallback mechanisms.
- **OpenAI Live Mode**: Set `LLM_PROVIDER=openai`, `LLM_API_KEY=sk-...`, `LLM_MODEL=gpt-4o-mini`.

### B. PayPal Payment Gateway
- **Mock Sandbox Mode**: Default when `PAYPAL_CLIENT_ID` is unset. Simulates the PayPal order lifecycle with mock IDs and HMAC validations.
- **Live PayPal Sandbox**: Set `PAYPAL_ENV=sandbox`, `PAYPAL_CLIENT_ID`, and `PAYPAL_CLIENT_SECRET` with valid sandbox credentials from [developer.paypal.com](https://developer.paypal.com). Performs live HTTPS requests to `https://api-m.sandbox.paypal.com`.

---

## 9. Current Disclosures & Production Roadmap

1. **Controlled Demonstration Catalogue**:
   - Seller offers originate from a curated, controlled demonstration catalogue. Live marketplace scraping is neither claimed nor performed.
2. **Sandbox Environment Only**:
   - All payment checkouts execute strictly against the PayPal Sandbox environment (`https://api-m.sandbox.paypal.com`). Production PayPal credentials and live payment capture are strictly prohibited.
3. **Authentication & Session Tokens**:
   - Session tokens are minted via `POST /api/auth/session` and verified via HMAC signatures (`Authorization: Bearer <token>`). Arbitrary client identity headers (`x-user-id`/`x-session-id`) are strictly rejected.
   - *Production Roadmap*: Integrate enterprise OpenID Connect / OAuth2 IdP.
4. **Local Persistence**:
   - Utilizes native Node.js SQLite (`--experimental-sqlite`) creating `./data/dealmind.sqlite`.
   - *Production Roadmap*: PostgreSQL with connection pooling.

---

## 10. Test Verification Summary

The project includes 10 automated test suites verifying all layers of the architecture:

| Test Suite | Purpose | Tests |
|---|---|:---:|
| `recoveryAudit.test.ts` | Frontend audit trail and recovery persistence | 4 |
| `businessRules.test.ts` | Intent validation, offer scoring, discount calculations | 8 |
| `phase3SecurityGateway.test.ts` | Canonical hashing, policy verification, replay prevention | 26 |
| `phase2Negotiation.test.ts` | Multi-agent dialogue, counteroffer generation, concession logic | 16 |
| `llmNegotiationSecurity.test.ts` | Prompt injection defense, schema enforcement, fallback logic | 20 |
| `recoveryVerification.test.ts` | Hosted checkout URLs, sanitization, capture recovery | 15 |
| `endToEndDemoHardening.test.ts` | Full lifecycle, refresh recovery, tampering, timeout handling | 11 |
| `backendSecurity.test.ts` | Express middleware, IDOR protection, session auth | 24 |
| `securityHardeningAudit.test.ts` | Cross-user isolation, token hashing, state tampering | 20 |
| `paypalCheckoutSecurity.test.ts` | Order creation, capture, amount/currency matching, token consumption | 38 |
| **Total Test Cases** | **Full Workspace Verification** | **182 Passed** |
| **Backend Total** | **Server Test Suites (6 suites)** | **128 Passed** |
