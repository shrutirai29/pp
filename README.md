# DealMind + IntentLock: Autonomous Deal Agent & Transaction Security Gateway

> **Phase 3: Independent Transaction Security Gateway**  
> Built for the AI Commerce & Security Hackathon.

DealMind is an autonomous shopping and negotiation system designed to evaluate real-time product offers, rank eligible merchant bids, and negotiate pricing and fulfillment terms on behalf of buyers. To ensure compliance, DealMind is paired with **IntentLock™**—an independent transaction security gateway that audits the complete seller-approved final deal against the buyer's original non-negotiable intent before payment can be authorized.

---

## 1. Phase 3 Architecture: Transaction Security Gateway

In Phase 3, IntentLock is elevated into an independent security layer separated from the buyer agent:

- **Complete Deal Verification (`src/lib/intentlock/policyEngine.ts`):**
  - Audits the complete `FinalDeal` contract rather than detached pricing.
  - Independently recalculates total payables ($\text{productPrice} + \text{deliveryFee} + \text{otherCharges}$) to block math tampering or hidden surcharge manipulation.
  - Validates all 9 critical security categories:
    1. **Transaction Status:** Rejects unaccepted, failed, or timed-out negotiations.
    2. **Currency Invariance:** Requires currency match between user authorization and merchant quotation.
    3. **Product Integrity:** Checks SKU/title identity to detect unexpected specification changes.
    4. **Condition Verification:** Enforces strict new condition rules.
    5. **Budget Ceiling:** Enforces hard budget ceilings on independently recalculated totals.
    6. **Delivery Window:** Enforces fulfillment calendar limits against actual seller terms.
    7. **Recurring Charge Quarantine:** Blocks hidden subscription lock-in.
    8. **Fee Transparency:** Rejects unitemized or unexplained secondary fees.
    9. **Warranty Coverage:** Flags missing warranty terms as `NEEDS_REVIEW`; rejects substandard coverage.

- **Cryptographic Contract Fingerprinting (`src/lib/intentlock/transactionIntegrity.ts`):**
  - Generates a canonical, deterministic SHA-256 fingerprint over all security-relevant fields.
  - Volatile UI fields, timestamps, and conversational transcripts are excluded.
  - Any post-verification alteration (price, delivery, subscription, warranty, currency) mutates the fingerprint.

- **Explicit Human Approval State Machine (`src/lib/intentlock/approvalManager.ts`):**
  ```
  NEGOTIATED ──► VERIFYING ──┬──► REJECTED (violations detected)
                             ├──► NEEDS_REVIEW (missing evidence)
                             └──► VERIFIED
                                    │
                                    ▼
                         AWAITING_USER_APPROVAL
                                    │
                         ┌──────────┴──────────┐
                         ▼                     ▼
                      DECLINED              APPROVED
                                               │
                                               ▼
                                       PAYMENT_AUTHORIZED (One-Time Token)
  ```
  - **No Autonomous Payment Authorization:** The buyer agent cannot approve transactions on the user's behalf.
  - **Fingerprint Binding:** Approvals are cryptographically bound to the exact deal fingerprint. Any post-verification term changes invalidate the approval immediately.
  - **Expiration TTL:** Approval requests expire after 15 minutes.
  - **One-Time Token Consumption:** Issued authorization tokens can only be consumed once, preventing replay attacks.

---

## 2. Technology Stack

- **Frontend:** React 18 + Vite + TypeScript (Strict Mode)
- **Styling:** Tailwind CSS (Fintech navy foundation with electric-blue & violet accents)
- **Icons:** Lucide React
- **Unit Testing:** Vitest (50 automated tests across all 3 phases)

---

## 3. Directory Structure

```
src/
├── components/
│   ├── audit/           # AuditTimeline.tsx
│   ├── deals/           # DealCard, OfferComparisonCard, OriginalRequirementsCard
│   ├── intentlock/      # VerificationReportCard, CheckDetailItem, ApprovalModal
│   ├── layout/          # Navbar, Footer
│   ├── negotiation/     # NegotiationTimeline
│   └── ui/              # Badge, Button, StatusIndicator, NotificationBanner
├── data/
│   ├── mockAuditEvents.ts
│   ├── mockOffers.ts
│   ├── mockProducts.ts
│   └── mockSellerPolicies.ts
├── lib/
│   ├── agents/
│   │   ├── buyerAgent.ts          # Buyer agent strategy & constraint protection
│   │   ├── sellerAgent.ts         # Seller agent simulator (Flexible, Strict, Conditional)
│   │   ├── negotiationEngine.ts   # Multi-round protocol coordinator (Max 5 rounds)
│   │   └── negotiationStrategy.ts # Opening discount calculation & concession pacing
│   ├── intentlock/
│   │   ├── intentVerifier.ts      # Orchestrates independent verification report generation
│   │   ├── policyEngine.ts        # 9 independent policy check implementations
│   │   ├── transactionIntegrity.ts# Canonical serialization & SHA-256 fingerprint generator
│   │   ├── approvalManager.ts     # Human approval lifecycle state machine
│   │   └── verificationTypes.ts   # Canonical deal data, approval records, verification report
│   ├── __tests__/
│   │   ├── businessRules.test.ts        # Phase 1 constraint tests (8 tests)
│   │   ├── phase2Negotiation.test.ts    # Phase 2 multi-agent tests (16 tests)
│   │   └── phase3SecurityGateway.test.ts# Phase 3 gateway & integrity tests (26 tests)
│   ├── currency.ts
│   ├── dealScoring.ts
│   ├── mockNegotiation.ts
│   ├── mockVerification.ts
│   └── validation.ts
├── pages/               # Dashboard, FindDeal, DealWorkspace, Negotiation, Verification, AuditTrail
├── types/               # deal.ts, offer.ts, negotiation.ts, sellerPolicy.ts, verification.ts, audit.ts
├── App.tsx
├── index.css
└── main.tsx
```

---

## 4. Running the Application Locally

```powershell
# 1. Install dependencies
npm install

# 2. Run unit tests (50 tests passing)
npm test

# 3. Start local development server
npm run dev
# Open http://localhost:5173

# 4. Production build
npm run build
```

---

## 5. Automated Vitest Suite (50 Tests Passing)

```
✓ src/lib/__tests__/businessRules.test.ts (8 tests)
✓ src/lib/__tests__/phase2Negotiation.test.ts (16 tests)
✓ src/lib/__tests__/phase3SecurityGateway.test.ts (26 tests)
  ✓ 1. Valid seller-accepted FinalDeal passes all IntentLock security checks
  ✓ 2. Unaccepted seller agreement (isAcceptedBySeller: false) fails verification
  ✓ 3. Failed negotiation is rejected
  ✓ 4. Timeout negotiation (5 rounds exceeded) is rejected
  ✓ 5. Deal exceeding budget ceiling is rejected
  ✓ 6. Recalculated total mismatch (tampered totalPayable) is rejected immediately
  ✓ 7. Currency mismatch between user intent and deal is rejected
  ✓ 8. Refurbished condition violates new-only intent and is rejected
  ✓ 9. Delivery beyond authorized maximum is rejected
  ✓ 10. Subscription violation is rejected when user prohibited subscriptions
  ✓ 11. Missing subscription terms require review when subscription is flagged
  ✓ 12. Missing warranty declaration requires review (never auto-passes)
  ✓ 13. Warranty duration below required minimum is rejected
  ✓ 14. Mandatory charge with missing description is flagged as fee violation
  ✓ 15. Fingerprint remains stable and deterministic for equivalent canonical objects
  ✓ 16. Price alteration changes fingerprint
  ✓ 17. Delivery alteration changes fingerprint
  ✓ 18. Subscription status alteration changes fingerprint
  ✓ 19. Warranty alteration changes fingerprint
  ✓ 20. Unverified deals (Rejected or Needs Review) cannot request user approval
  ✓ 21. User can explicitly approve a verified deal and receive a payment authorization token
  ✓ 22. User can explicitly decline a verified deal
  ✓ 23. Expired approval cannot be consumed or approved
  ✓ 24. Modifying transaction terms after report generation invalidates approval binding
  ✓ 25. An authorization token can only be consumed once at checkout (replay prevention)
  ✓ 26. Failed negotiation cannot produce payment authorization under any circumstances
```

---

## 6. Phase 3 Status: Functional vs. Simulated

| Security Capability | Implementation Status | Technical Reality |
| :--- | :--- | :--- |
| **Independent Verification Engine** | **Functional** | Evaluates all 9 hard requirements directly on FinalDeal |
| **Total Recalculation Guard** | **Functional** | Independently calculates productPrice + fees; rejects mathematical inconsistencies |
| **Bilateral Acceptance Check** | **Functional** | Rejects any unagreed, failed, or timed-out negotiation session |
| **SHA-256 Contract Fingerprint** | **Functional** | Deterministic canonical serialization hashing security-relevant terms |
| **Human Approval Gate** | **Functional** | Requires user confirmation; supports approval, decline, and expiration |
| **Replay & One-Time Token Guard** | **Functional** | Single-use consumption token bound to exact contract fingerprint |
| **Tamper Invalidation** | **Functional** | Modifying terms post-verification invalidates approval immediately |
| **Cryptographic Root of Trust** | **Demonstration Model** | In-browser SHA-256 demonstrates integrity logic. Authoritative protection requires a trusted server backend holding cryptographic keys |
| **PayPal Sandbox Gateway** | **Scheduled** | Reserved for Phase 4 backend integration |
