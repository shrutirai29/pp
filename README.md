# DealMind + IntentLock: Autonomous Deal Agent & Persistent Transaction Security Gateway

> **Phase 4: Secure Backend, Persistent IntentLock & API Integration**  
> Built for the AI Commerce & Security Hackathon.

DealMind is an autonomous shopping and negotiation system designed to evaluate real-time product offers, rank eligible merchant bids, and negotiate pricing and fulfillment terms on behalf of buyers. To ensure compliance, DealMind is paired with **IntentLock™**—an independent transaction security gateway that server-enforces and audits the complete seller-approved final deal against the buyer's original non-negotiable intent before payment can be authorized.

In Phase 4, IntentLock is transitioned from a browser-only security model into an authoritative, server-enforced, SQLite-backed security gateway.

---

## 1. Phase 4 Architecture: Server-Enforced Security & Persistence

```
┌────────────────────────────────────────────────────────┐
│               Frontend (React 18 + Vite)                │
│  - Natural Language Intent Capture                     │
│  - Multi-Agent Negotiation Simulation                   │
│  - Live Verification Verdict & Audit Visualization     │
└───────────────────────────┬────────────────────────────┘
                            │ (REST API with x-user-id isolation)
                            ▼
┌────────────────────────────────────────────────────────┐
│             Secure Express Backend (Node 24)            │
│  ├── Middleware: Rate Limiter, Auth/Session, Zod Valid  │
│  ├── IntentLock Policy Engine (9 Server Checks)         │
│  ├── Cryptographic Service (SHA-256 + HMAC Tokens)      │
│  └── Repositories: Deals, Reports, Approvals, Audit     │
└───────────────────────────┬────────────────────────────┘
                            │ (WAL Mode, ACID Transactions)
                            ▼
┌────────────────────────────────────────────────────────┐
│            SQLite Persistent Storage (Engine)           │
│  ├── deals (UserIntent + FinalDeal JSON)               │
│  ├── verification_reports (Fingerprints + Status)       │
│  ├── approvals (State Machine + Token Hashes + TTL)     │
│  └── audit_events (Append-Only Immutable Event Log)     │
└────────────────────────────────────────────────────────┘
```

### Core Security Principles Enforced on Backend:
1. **Untrusted Client Inputs:** All input from the browser is validated through strict Zod schemas (`userIntentSchema`, `finalDealSchema`, `approvalRequestSchema`, `userDecisionSchema`).
2. **Server-Side Policy Engine (`server/src/services/intentLockService.ts`):** 9 independent checks run entirely on the server. The buyer agent in the frontend cannot approve or bypass verification.
3. **Canonical SHA-256 Fingerprint (`server/src/services/integrityService.ts`):** Security-relevant terms are deterministically ordered and hashed with SHA-256. Any difference in price, fees, warranty, condition, or delivery results in a completely different fingerprint.
4. **HMAC-SHA256 Authorization Tokens:** When a user explicitly approves a verified deal, the server computes an HMAC-SHA256 signature using a server-side secret (`TOKEN_HMAC_SECRET`). Only token hashes are stored in the database.
5. **Atomic Replay Prevention:** `POST /api/deals/:id/consume-authorization` executes an atomic SQLite transaction (`BEGIN IMMEDIATE TRANSACTION`). If a token was already consumed, subsequent attempts are rejected with `HTTP 409 Conflict`.
6. **Post-Verification Tampering Detection:** When the user sends an approval decision, the server re-verifies the fingerprint of the submitted `FinalDeal`. If any parameter changed since verification, the server rejects with `HTTP 400 Bad Request` ("Deal terms have been modified post-verification").
7. **Session Data Isolation:** Every request is authenticated with an `x-user-id` header, enforcing strict data isolation across different users and sessions.

---

## 2. API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Server health check and uptime probe |
| `POST` | `/api/deals` | Register or sync deal intent and final deal parameters |
| `GET` | `/api/deals` | List deals belonging to the current authenticated user |
| `GET` | `/api/deals/:id` | Fetch details of a specific deal |
| `POST` | `/api/deals/:id/verify` | Execute independent server-side IntentLock verification |
| `GET` | `/api/deals/:id/verification`| Retrieve the latest verification report for a deal |
| `POST` | `/api/deals/:id/approval-request` | Create an approval request record with 15-minute TTL |
| `POST` | `/api/deals/:id/approve` | Explicit human purchase authorization (issues HMAC token) |
| `POST` | `/api/deals/:id/decline` | Explicit human decline of transaction terms |
| `POST` | `/api/deals/:id/consume-authorization` | Atomically consumes single-use token (replay protection) |
| `GET` | `/api/deals/:id/audit` | Fetch append-only audit trail records |

---

## 3. Technology Stack

- **Backend:** Node.js 24 + Express + TypeScript
- **Database:** SQLite (Native `node:sqlite` with WAL mode and foreign key constraints)
- **Validation:** Zod 3 runtime schemas
- **Cryptography:** Node.js built-in `crypto` (SHA-256 canonical hashing + HMAC-SHA256 signing)
- **Frontend:** React 18 + Vite + TypeScript (Strict Mode)
- **Styling:** Tailwind CSS (Fintech dark navy foundation with electric-blue & violet accents)
- **Icons:** Lucide React
- **Testing:** Vitest (74 automated tests across frontend and backend)

---

## 4. Directory Structure

```
├── server/                              # Node.js + Express Backend
│   ├── src/
│   │   ├── config/env.ts                # Validated environment configuration
│   │   ├── db/
│   │   │   ├── database.ts              # SQLite schema creation & WAL mode setup
│   │   │   └── sqliteAdapter.ts         # Native SQLite adapter
│   │   ├── middleware/
│   │   │   ├── auth.ts                  # Session user identification (x-user-id)
│   │   │   ├── errorHandler.ts          # Centralized error handler
│   │   │   └── rateLimiter.ts           # Sliding-window IP rate limiter
│   │   ├── repositories/
│   │   │   ├── dealRepository.ts        # Deal persistence
│   │   │   ├── verificationRepository.ts# Verification reports storage
│   │   │   ├── approvalRepository.ts    # Approval state machine & token storage
│   │   │   └── auditRepository.ts       # Append-only immutable audit trail
│   │   ├── routes/api.ts                # Express REST API routes
│   │   ├── schemas/dealSchemas.ts       # Zod schemas for UserIntent and FinalDeal
│   │   ├── services/
│   │   │   ├── integrityService.ts      # Canonical hashing & HMAC tokens
│   │   │   └── intentLockService.ts     # Server policy verification engine
│   │   ├── app.ts                       # Express app factory
│   │   └── server.ts                    # HTTP server entrypoint
│   ├── tests/
│   │   └── backendSecurity.test.ts      # 24 comprehensive backend security tests
│   ├── package.json
│   └── tsconfig.json
├── src/                                 # React + Vite Frontend
│   ├── components/                      # Dashboard, Workspace, Negotiation, IntentLock UI
│   ├── lib/
│   │   ├── api/client.ts                # Typed API client with graceful fallback
│   │   ├── agents/                      # Buyer and simulated seller negotiation agents
│   │   ├── intentlock/                  # Client-side validation models & types
│   │   └── __tests__/                   # Phase 1, 2, and 3 test suites (50 tests)
│   ├── pages/                           # Application views
│   ├── types/                           # TypeScript interfaces
│   └── App.tsx
├── package.json
└── vite.config.ts
```

---

## 5. Running the Application Locally

### Quick Start (Full Stack)

```powershell
# 1. Install root dependencies
npm install

# 2. Install server dependencies
cd server
npm install
cd ..

# 3. Run all 74 unit and integration tests
npm test

# 4. Start the backend server (Port 4000)
npm run server

# 5. In a second terminal, start the Vite frontend (Port 5173)
npm run dev
# Open http://localhost:5173 in your browser
```

### Dedicated Commands

```powershell
# Run backend security tests only
npm run server:test

# Build backend TypeScript
npm run server:build

# Build frontend and backend together
npm run build:all
```

---

## 6. Automated Test Suite (74 Tests Passing)

```
Test Files  4 passed (4)
Tests       74 passed (74)

✓ src/lib/__tests__/businessRules.test.ts (8 tests)
✓ src/lib/__tests__/phase2Negotiation.test.ts (16 tests)
✓ src/lib/__tests__/phase3SecurityGateway.test.ts (26 tests)
✓ server/tests/backendSecurity.test.ts (24 tests)
    ✓ 1. Rejects deal verification when totalPayable does not match recalculated sum
    ✓ 2. Rejects deal verification when seller acceptance is false
    ✓ 3. Rejects deal verification when budget ceiling is exceeded
    ✓ 4. Rejects deal verification when condition is refurbished for new-only intent
    ✓ 5. Rejects deal verification when delivery exceeds user limit
    ✓ 6. Rejects deal verification when subscription is present despite prohibition
    ✓ 7. Approves deal verification when all hard constraints are satisfied
    ✓ 8. Returns 404 when verifying a non-existent deal
    ✓ 9. Generates deterministic SHA-256 fingerprint for valid deal
    ✓ 10. Computes different fingerprint when deal terms change
    ✓ 11. Refuses approval creation for rejected deals
    ✓ 12. Creates approval record with 15-minute expiration for verified deals
    ✓ 13. Allows explicit human approval and issues single-use authorization token
    ✓ 14. Rejects human approval if deal terms were modified after verification
    ✓ 15. Allows human to decline verified deal
    ✓ 16. Allows single-use authorization token consumption
    ✓ 17. Rejects token replay on second consumption attempt (replay protection)
    ✓ 18. Rejects token consumption with invalid authorization token
    ✓ 19. Rejects token consumption when deal was declined
    ✓ 20. Rejects token consumption when approval is expired
    ✓ 21. Enforces data isolation between different user IDs
    ✓ 22. Persists deal and verification report across database re-initialization
    ✓ 23. Appends immutable audit records for each lifecycle transition
    ✓ 24. Validates request payloads with Zod schemas and returns 400 on malformed input
```

---

## 7. Security Capability Matrix

| Security Capability | Implementation Status | Technical Reality |
| :--- | :--- | :--- |
| **Server-Enforced Policy Engine** | **Functional** | Evaluates all 9 checks on Express backend; client agent cannot approve |
| **Total Recalculation Guard** | **Functional** | Server independently calculates productPrice + fees; rejects arithmetic mismatches |
| **Bilateral Acceptance Verification** | **Functional** | Server rejects unagreed or unaccepted sessions |
| **SHA-256 Contract Fingerprint** | **Functional** | Canonical JSON ordering hashing security terms; changes upon any modification |
| **Tamper Invalidation Gate** | **Functional** | Approval endpoint re-verifies fingerprint; rejects post-verification modifications |
| **HMAC-SHA256 Token Authority** | **Functional** | Backend issues cryptographic authorization tokens signed with server secret |
| **Single-Use Replay Protection** | **Functional** | Atomic SQLite transaction invalidates token upon first consumption |
| **Persistent SQLite Storage** | **Functional** | Data persists across server restarts in WAL mode with foreign keys |
| **Audit Trail Immutability** | **Functional** | Append-only SQLite event ledger recording actor, timestamp, and metadata |
| **Session Isolation** | **Functional** | User identity separation via session headers preventing cross-account access |
| **PayPal Sandbox Gateway** | **Out of Scope** | Reserved for future payment processor handoff |
