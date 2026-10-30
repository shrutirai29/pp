# DealMind + IntentLock: Autonomous Deal Agent & Security Quarantine Layer

> **Phase 2: Intelligent Buyer Agent & Negotiation Engine**  
> Built for the AI Commerce & Security Hackathon.

DealMind is an autonomous shopping and negotiation system designed to evaluate real-time product offers, rank eligible merchant bids, and negotiate pricing and fulfillment terms on behalf of buyers. To prevent non-compliant purchases, DealMind is paired with **IntentLock™**—an independent verification layer that audits the structured final deal terms against the buyer's non-negotiable intent before any checkout can be authorized.

---

## 1. What's New in Phase 2: Intelligent Multi-Agent Negotiation

In Phase 1, negotiation was simulated with a static 4-message script. **Phase 2 replaces this with a stateful, modular multi-agent negotiation system**:

- **Intelligent Buyer Agent (`src/lib/agents/buyerAgent.ts`):**
  - Formulates rational opening bids (10%–14% target discounts bounded by buyer budget).
  - Evaluates seller counteroffers round-by-round.
  - Explains every negotiation decision with strategic reasoning (`decisionRationale`).
  - **Zero Compromise on Hard Constraints:** Immediately rejects counteroffers that specify non-new conditions, attached recurring subscriptions, delivery delays beyond the cutoff, or total prices exceeding the budget.
  - Never trades away hard non-negotiable constraints in exchange for a lower price.

- **Simulated Seller Policies (`src/lib/agents/sellerAgent.ts` & `src/types/sellerPolicy.ts`):**
  - Private seller policy data (e.g., `privateMinimumAcceptablePrice`) is strictly kept separate from buyer-visible offer data.
  - Three distinct seller behavior archetypes:
    1. **Flexible Seller (e.g. TechHaven Direct):** High-volume enterprise vendor. Welcomes verified fast settlement and makes balanced concessions towards the buyer's bid down to reservation floor.
    2. **Strict Seller (e.g. Titan Silicon Direct):** Fixed distributor policy. Makes small token concessions and firmly rejects bids below its private minimum floor.
    3. **Conditional Seller (e.g. Prime Storage Solutions):** Concedes on delivery charges (waiving ₹200 shipping fee) and extends warranty duration in exchange for purchase commitment.

- **Stateful Negotiation Engine (`src/lib/agents/negotiationEngine.ts`):**
  - Multi-round negotiation protocol capped at 5 rounds.
  - Rejection or maximum round timeout safely ends negotiation with clear failure rationale.
  - Rule 11 Enforcement: Ineligible seller offers are blocked from entering negotiation.

- **Structured `FinalDeal` Data Model (`src/types/negotiation.ts`):**
  - Comprehensive contract representation containing product title, seller ID, condition, product price, delivery fee, mandatory charges, total payable, delivery estimate, warranty, subscription status, round count, and complete message transcript.
  - Safe integer/minor-unit currency calculations to eliminate floating-point inaccuracies.

- **IntentLock™ Architectural Integration (`src/lib/mockVerification.ts`):**
  - IntentLock now audits the complete negotiated `FinalDeal` object directly (rather than testing pre-negotiation offer fields with a detached price).
  - Preserves independent security boundaries: buyer agent agreement does not bypass IntentLock audit.

---

## 2. Technology Stack

- **Frontend:** React 18 + Vite + TypeScript (Strict Mode)
- **Styling:** Tailwind CSS (Fintech navy foundation with electric-blue & violet accents)
- **Icons:** Lucide React
- **Unit Testing:** Vitest (21 automated tests covering business rules and multi-agent negotiation)

---

## 3. Directory Structure

```
src/
├── components/
│   ├── audit/           # AuditTimeline.tsx
│   ├── deals/           # DealCard, OfferComparisonCard, OriginalRequirementsCard
│   ├── intentlock/      # VerificationReportCard, CheckDetailItem
│   ├── layout/          # Navbar, Footer
│   ├── negotiation/     # NegotiationTimeline (Multi-agent stream, rationales, final deal card)
│   └── ui/              # Badge, Button, StatusIndicator, NotificationBanner
├── data/
│   ├── mockAuditEvents.ts
│   ├── mockOffers.ts         # Includes Flexible, Conditional, and Disqualified merchants
│   ├── mockProducts.ts
│   └── mockSellerPolicies.ts # Private seller reservation prices and profile policies
├── lib/
│   ├── agents/
│   │   ├── buyerAgent.ts          # Intelligent buyer agent decision engine
│   │   ├── sellerAgent.ts         # Seller agent simulator (Flexible, Strict, Conditional)
│   │   ├── negotiationEngine.ts   # Multi-round protocol coordinator (Max 5 rounds)
│   │   └── negotiationStrategy.ts # Concession pacing and opening bid calculation
│   ├── __tests__/
│   │   ├── businessRules.test.ts    # Phase 1 constraint tests (8 tests)
│   │   └── phase2Negotiation.test.ts# Phase 2 multi-agent tests (13 tests)
│   ├── currency.ts
│   ├── dealScoring.ts         # Scorer and enhanced offer ranking
│   ├── mockNegotiation.ts     # Backward-compatible negotiation entry point
│   ├── mockVerification.ts    # IntentLock verification engine (audits FinalDeal)
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

# 2. Run unit tests (21 tests)
npm test

# 3. Start local development server
npm run dev
# Open http://localhost:5173

# 4. Production build
npm run build
```

---

## 5. Phase 2 Automated Test Coverage (21 Tests)

```
✓ src/lib/__tests__/businessRules.test.ts (8 tests)
  ✓ calculates total price from base, delivery, and mandatory charges
  ✓ accepts a fully compliant offer as eligible and passes IntentLock verification
  ✓ rejects a refurbished product when new is required (Rule 4)
  ✓ rejects an offer whose total price exceeds the budget ceiling (Rule 6)
  ✓ rejects an offer with delivery time beyond the maximum limit (Rule 5)
  ✓ rejects an offer with a subscription when user prohibits subscriptions (Rule 3)
  ✓ flags missing warranty information as Needs Review (Rule 7)
  ✓ cheaper listing price NEVER overrides a hard constraint (Rules 8, 9, 11)

✓ src/lib/__tests__/phase2Negotiation.test.ts (13 tests)
  ✓ 1. Flexible seller accepts a reasonable offer above its private minimum
  ✓ 2. Strict seller rejects an offer below its private minimum floor
  ✓ 3. Conditional seller can negotiate delivery terms by waiving delivery fee
  ✓ 4. Buyer agent never exceeds the user's hard budget
  ✓ 5. Buyer agent rejects a counteroffer with refurbished condition when new is mandatory
  ✓ 6. Buyer agent rejects a counteroffer that introduces a recurring subscription
  ✓ 7. Negotiation stops after a maximum of five rounds
  ✓ 8. Immediate seller rejection terminates the negotiation session
  ✓ 9. Final deal total payable strictly equals product price + delivery fee + mandatory charges
  ✓ 10. Produces a complete structured FinalDeal with all required parameters for IntentLock
  ✓ 11. An ineligible seller offer cannot enter negotiation
  ✓ 12. A failed negotiation never produces an accepted final deal
  ✓ Enhanced Ranking: Eligible offers always outrank ineligible ones regardless of price
```

---

## 6. Phase 2 Status: Functional vs. Simulated

| Feature / Module | Status | Notes |
| :--- | :--- | :--- |
| **Multi-Agent Negotiation Engine** | **Functional** | Real-time state machine coordinating Buyer and Seller Agent decisions up to 5 rounds |
| **Buyer Agent Reasoning** | **Functional** | Concession calculation, hard-constraint protection, strategic rationales |
| **Seller Behavior Profiles** | **Functional** | Flexible, Strict, and Conditional policies with private reservation floors |
| **FinalDeal Contract Model** | **Functional** | Complete structured deal passed to IntentLock with price and non-price terms |
| **IntentLock Verification** | **Functional** | Independent cryptographic audit of the complete `FinalDeal` |
| **Seller Catalogue & APIs** | **Simulated** | Controlled catalogue and simulated seller agents (no real retailer scraping in Phase 2) |
| **LLM Inference** | **Simulated** | Rule- and policy-based agent simulation; ready for Node.js LLM service in Phase 3 |
| **PayPal Sandbox** | **Scheduled** | Reserved for Phase 4 backend integration |
