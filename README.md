# DealMind + IntentLock™: Autonomous Deal Agent & PayPal Sandbox Security Gateway

> **Autonomous AI Commerce Protected by Independent Cryptographic Verification and Explicit Human Authorization**  
> Built for the PayPal AI Commerce & Transaction Security Hackathon.

---

## 1. Problem Statement

Autonomous AI shopping and procurement agents promise to revolutionize commerce by finding deals, evaluating merchant terms, and negotiating pricing without manual effort. However, granting autonomous AI agents direct access to payment gateways creates severe security risks:

- **Agent Drift & Hallucination**: AI agents may accept terms that violate user constraints (e.g. paying above budget, accepting hidden subscriptions, or waiving warranty protection).
- **Prompt Injection & Adversarial Sellers**: Malicious sellers can craft prompt-injection attacks that deceive buyer agents into agreeing to unfavorable conditions.
- **Unauthorized Payments & Double-Spending**: Without an out-of-band verification boundary, an agent can authorize irreversible payments without explicit human consent.

**DealMind + IntentLock™ solves this fundamental safety challenge.**

---

## 2. DealMind vs. IntentLock™

| Capability | DealMind (Negotiation Agent) | IntentLock™ (Security Gateway) |
|---|---|---|
| **Primary Role** | Market Discovery & Autonomous Negotiation | Zero-Trust Verification & Payment Gatekeeper |
| **Authority** | Proposes and discusses candidate agreements | Holds exclusive authority to permit payment |
| **Logic** | Multi-agent dialogue (Groq LLM / heuristics) | Independent 9-criteria deterministic audit |
| **Cryptographic Role** | Formats final deal terms | Computes SHA-256 contract fingerprint & signs tokens |
| **Human Approval** | Presents deal report to user | Issues HMAC-signed single-use authorization token |
| **Payment Integration** | Does not touch payment credentials | Governs PayPal order creation & capture |
| **Failure Mode** | May stall or propose bad terms | **Blocks transaction instantly** before checkout |

---

## 3. System Architecture & Transaction Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         React 18 Fintech Frontend                        │
│    Left Sidebar · Modern Data Table · Dynamic Intent Form · Audit Panel   │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │ (REST API + HMAC Session Tokens)
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                      Express Backend (Node.js 24)                        │
│                                                                          │
│  ┌───────────────────────┐                  ┌─────────────────────────┐  │
│  │   Autonomous Multi-   │                  │   IntentLock Gateway    │  │
│  │     Agent Engine      │                  │   - 9-Criteria Audit    │  │
│  │ - Groq / Heuristics   │ ──(Final Deal)──►│   - SHA-256 Fingerprint │  │
│  │ - Bilateral Dialogue  │                  │   - Tamper Detection    │  │
│  └───────────────────────┘                  └────────────┬────────────┘  │
│                                                          │               │
│                                                          ▼               │
│  ┌───────────────────────┐                  ┌─────────────────────────┐  │
│  │    Audit Repository   │                  │  Human Approval Gate    │  │
│  │ - Immutable SQLite    │◄─────────────────│  - 15-Min TTL Window    │  │
│  │ - Tamper-Evident Logs │                  │  - HMAC Single-Use Token│  │
│  └───────────────────────┘                  └────────────┬────────────┘  │
│                                                          │               │
│                                                          ▼               │
│                                             ┌─────────────────────────┐  │
│                                             │    Payment Service      │  │
│                                             │  - Currency Allowlist   │  │
│                                             │  - Exact Amount Match   │  │
│                                             │  - Atomic Token Consume │  │
│                                             └────────────┬────────────┘  │
└──────────────────────────────────────────────────────────┼───────────────┘
                                                           │ (REST v2)
                                                           ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                       PayPal Sandbox Gateway                             │
│   - Order Creation (`/v2/checkout/orders` with Return/Cancel URLs)       │
│   - Hosted Checkout Buyer Approval (`https://www.sandbox.paypal.com`)    │
│   - Authoritative Server Capture (`/v2/checkout/orders/{id}/capture`)    │
│   - Idempotency & Reconciliation (`PayPal-Request-Id`)                   │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Key Security & Functional Capabilities

### A. Groq-Powered Multi-Agent Negotiation
- **Provider**: Live Groq API (`openai/gpt-oss-120b`) with fast, low-latency completions.
- **Bilateral Dialogue**: Buyer Agent negotiates against Seller Agent across multi-round proposals with concession curves, budget constraints, and warranty requirements.
- **Deterministic Fallback**: If external LLM APIs are offline, DealMind seamlessly falls back to a deterministic rule-based heuristic policy without stalling.

### B. Independent 9-Criteria IntentLock Verification
Before payment checkout can be initiated, IntentLock recalculates and verifies all 9 transaction invariants:
1. **Transaction Status**: Validates bilateral agreement (`agreed: true`).
2. **Currency Invariance**: Strictly checks that deal currency matches user intent (`USD`).
3. **Product Integrity**: Verifies exact product specification and identifier match.
4. **Condition Compliance**: Confirms hardware condition matches requirement (`new`).
5. **Budget Ceiling**: Strictly proves total payable $\le$ buyer budget ceiling (with exact zero-tolerance minor-unit arithmetic).
6. **Delivery Window**: Fulfillment days $\le$ user requirement.
7. **No Subscriptions**: Confirms one-time purchase with zero recurring subscriptions.
8. **Itemized Ancillary Fees**: Audits base price, shipping fees, and taxes with zero undeclared fees.
9. **Warranty Coverage**: Validates warranty term $\ge$ user requirement.

### C. Cryptographic Contract Fingerprint & Tamper Resistance
IntentLock canonicalizes the agreed terms into a deterministic JSON representation and computes a **SHA-256 hash** (`dealFingerprint`). If any term (price, seller, warranty) is modified in transit or after verification, the fingerprint mismatches and the transaction is permanently revoked.

### D. Explicit Human Approval & Single-Use Authorization Token
- Deals cannot be checked out automatically. An explicit human signature is mandatory.
- Upon approval, the server mints an **HMAC-SHA256 authorization token** with a 15-minute time-to-live (`APPROVAL_VALIDITY_SECONDS=900`).
- The authorization token is strictly single-use and atomically transitioned to `CONSUMED` upon payment capture.

### E. PayPal Sandbox Order Creation with Hosted Checkout Safety
- Creates orders via PayPal Orders API v2 (`CAPTURE` intent).
- Strictly passes `return_url` and `cancel_url` in `application_context` to ensure the PayPal hosted checkout portal renders without error.
- Enforces an allowlist of 24 supported PayPal currencies (rejecting unsupported currencies like `INR` upfront).

### F. Authoritative Server Capture & Atomic Token Consumption
- After the buyer approves payment in the PayPal Sandbox portal, the backend issues an authoritative server-side capture (`POST /v2/checkout/orders/{id}/capture`).
- Validates that captured amount and currency match approved deal terms exactly.
- Atomically consumes the authorization token and transitions the deal to `payment_completed`.

### G. Idempotency & Reconciliation
- Re-executing checkout or capture with an existing completed order returns the completed record without secondary charges or duplicate orders.
- Dedicated reconciliation endpoint (`POST /api/deals/:id/reconcile`) queries PayPal and syncs state safely.

---

## 5. Verified Live PayPal Sandbox Transaction

The full lifecycle was verified end-to-end against live PayPal Sandbox APIs:

```text
Product:             Samsung 980 1TB PCIe 3.0 NVMe M.2 Internal SSD
Seller:              TechHaven Direct
Deal ID:             intent_1793891217448
Buyer Budget:        $85.00 USD
Agreed Price:        $74.00 USD
IntentLock Status:   VERIFIED (9/9 passed)
Contract Fingerprint:bcceecd365a58b4354218991e2f405a9b5d0e2aaa4134cef74129cd02460f2de
PayPal Order ID:     7M922293E62170201
PayPal Capture ID:   12P5471025765970Y
PayPal Order Status: COMPLETED
Capture Status:      COMPLETED (Gross: $74.00 USD, Fee: $3.76, Net: $70.24)
Authorization Token: CONSUMED
Deal Status:         payment_completed
```

---

## 6. Disclosures & Sandbox Notice

> [!IMPORTANT]
> **1. Controlled Demonstration Catalogue**:  
> Seller offers originate from a curated, controlled demonstration catalogue. Live marketplace scraping is neither claimed nor performed.
>
> **2. Sandbox Environment Only**:  
> All payment interactions run strictly in the **PayPal Sandbox** developer environment (`https://api-m.sandbox.paypal.com`). Production PayPal credentials and live card processing are strictly prohibited.
>
> **3. Authentication Model**:  
> The backend implements cryptographically signed session tokens via `POST /api/auth/session` using HMAC-SHA256 (`Authorization: Bearer <token>`). Arbitrary client headers (`x-user-id`) are untrusted and rejected.

---

## 7. Setup & Installation

### Prerequisites
- Node.js `v22.x` or `v24.x` (native Node.js `--experimental-sqlite` required)
- npm `v10+`

### Installation
```bash
# Clone the repository
git clone https://github.com/shrutirai29/pp.git
cd pp

# Install root & frontend dependencies
npm install

# Install backend dependencies
npm --prefix server install
```

### Environment Configuration
Copy `server/.env.example` to `server/.env`:
```bash
PORT=4000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
DATABASE_PATH=data/dealmind.sqlite
APPROVAL_VALIDITY_SECONDS=900
TOKEN_HMAC_SECRET=your_secure_hmac_secret_min_32_chars

# PayPal Sandbox Credentials (from developer.paypal.com)
PAYPAL_CLIENT_ID=your_sandbox_client_id
PAYPAL_CLIENT_SECRET=your_sandbox_client_secret
PAYPAL_ENV=sandbox
PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com
PAYPAL_RETURN_URL=http://localhost:5173/verification?paypal=return
PAYPAL_CANCEL_URL=http://localhost:5173/verification?paypal=cancel

# LLM Provider ('mock' for offline demo, or 'groq' | 'openai')
LLM_PROVIDER=mock
LLM_API_KEY=
LLM_MODEL=openai/gpt-oss-120b
```

---

## 8. Verification & Running

### Run Preflight Verification
```bash
npm --prefix server run preflight
```

### Run Tests
```bash
# Run backend test suite (128 tests)
npm --prefix server test

# Run full workspace test suite (182 tests)
npm test
```

### Build Frontend & Backend
```bash
npm --prefix server run build
npm run build
```

### Start Development Servers
```bash
# Terminal 1: Backend API on port 4000
npm --prefix server run dev

# Terminal 2: Frontend on port 5173
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 9. API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/session` | Mint signed HMAC session token |
| `GET` | `/api/deals` | List user deals |
| `POST` | `/api/deals` | Create purchase intent and deal draft |
| `GET` | `/api/deals/:id` | Get deal details, latest report, and approvals |
| `POST` | `/api/deals/:id/negotiate` | Execute bilateral multi-agent negotiation |
| `POST` | `/api/deals/:id/verify` | Run independent 9-check IntentLock audit |
| `POST` | `/api/deals/:id/approval-request` | Create human approval request (15-min TTL) |
| `POST` | `/api/deals/:id/approve` | Explicit human approval signature & token minting |
| `POST` | `/api/deals/:id/decline` | Decline deal terms |
| `POST` | `/api/deals/:id/checkout` | Create PayPal Sandbox order bound to fingerprint |
| `POST` | `/api/deals/:id/capture` | Authoritative server capture of approved PayPal order |
| `POST` | `/api/deals/:id/reconcile` | Reconcile payment status against PayPal API |
| `POST` | `/api/deals/:id/cancel-payment` | Safely cancel active payment to allow recovery |
| `GET` | `/api/deals/:id/audit-trail` | Fetch immutable hash-chained audit event ledger |
| `GET` | `/api/preflight` | Server and gateway configuration diagnostics |

---

## 10. Test Suites Summary

The codebase includes **182 automated tests** across 10 suites:

| Suite | Purpose | Count |
|---|---|:---:|
| `server/tests/paypalCheckoutSecurity.test.ts` | PayPal order creation, capture, amount/currency matching, token consumption | 38 |
| `server/tests/backendSecurity.test.ts` | Express middleware, session auth, IDOR, input sanitization | 24 |
| `server/tests/securityHardeningAudit.test.ts` | Cross-user isolation, token hashing, state tampering | 20 |
| `server/tests/llmNegotiationSecurity.test.ts` | Prompt injection defense, schema enforcement, fallback logic | 20 |
| `server/tests/recoveryVerification.test.ts` | Hosted checkout URLs, sanitization, capture recovery | 15 |
| `server/tests/endToEndDemoHardening.test.ts` | Full lifecycle, refresh recovery, tampering, timeout handling | 11 |
| `src/lib/__tests__/phase3SecurityGateway.test.ts` | Canonical hashing, policy verification, replay prevention | 26 |
| `src/lib/__tests__/phase2Negotiation.test.ts` | Multi-agent dialogue, counteroffer generation, concession logic | 16 |
| `src/lib/__tests__/businessRules.test.ts` | Intent validation, offer scoring, discount calculations | 8 |
| `src/lib/__tests__/recoveryAudit.test.ts` | Frontend audit trail and recovery persistence | 4 |
| **Workspace Total** | **Full End-to-End Test Suite** | **182 Passed** |
| **Backend Total** | **Server Test Suites (6 suites)** | **128 Passed** |

---

## 11. License

MIT
