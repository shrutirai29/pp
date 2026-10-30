# DealMind + IntentLock: Autonomous Deal Agent & Security Quarantine Layer

> **Phase 1: Project Foundation and Frontend MVP**  
> Built for the AI Commerce & Security Hackathon.

DealMind is an autonomous shopping and negotiation agent designed to find real-time product offers and negotiate on behalf of buyers. To ensure safety, DealMind is paired with **IntentLock™**—an independent verification layer that audits negotiated proposals against the buyer's non-negotiable intent before any checkout can be authorized.

---

## 1. Phase 1 Features

- **Dashboard:**
  - Active session metrics (Total Managed Deals, IntentLock Verified, Violations Blocked, Active Sessions).
  - Recent negotiation sessions with status badges (`Draft`, `Negotiating`, `Verification Required`, `Verified`, `Rejected`, `Payment Completed`).
  - Quick action to discover new deals or inspect the immutable audit ledger.

- **Find a Deal:**
  - Natural language intent input with an instant pre-fill option: *"Find me a new 1 TB SSD under ₹8,000, delivered within three days, with no subscriptions or additional charges."*
  - Granular constraint inputs: Maximum budget, currency, required condition (New, Refurbished, Any), max delivery timeframe, warranty requirements, and hard toggles prohibiting subscriptions and hidden surcharges.
  - Client-side validation with actionable error feedback.

- **Deal Workspace:**
  - Persistent display of the buyer's original non-negotiable constraints.
  - Multi-seller catalogue comparison featuring three test archetypes:
    1. **TechHaven Direct:** Fully compliant, factory-new, under-budget, 2-day delivery, 60-mo warranty.
    2. **SpeedyStorage Bazaar (The Trap):** Lower headline listing price (₹5,999) but bundles a hidden ₹299/mo subscription, 5-day delivery, and refurbished condition. Disqualified automatically.
    3. **Apex Silicon Hub:** Flagship SSD exceeding budget ceiling (₹8,649). Disqualified automatically.
  - **Rule 9 & 11 Enforcement:** Lower price never overrides hard constraints; only compliant offers can enter the negotiation workflow.

- **Autonomous Negotiation Timeline:**
  - 4-turn deterministic dialogue between DealMind Buyer Agent and Seller Automated Sales Desk.
  - Real-time price counter, itemized terms highlights, and total buyer savings calculation.

- **IntentLock™ Verification View:**
  - Visual verification report comparing buyer intent against seller contract terms.
  - 6 cryptographic rule evaluations covering budget, hardware condition, fulfillment window, hidden subscriptions, fee transparency, and warranty coverage.
  - Verification verdict states: `Verified`, `Rejected`, or `Needs Review`.
  - Non-compliant deals are locked with a "Return to Negotiation" remedy action.
  - Verified deals unlock a "Proceed to PayPal Checkout" button (clearly designated as Phase 4).

- **Cryptographic Audit Trail:**
  - Immutable ledger recording events from requirements creation to multi-seller comparison, bot negotiation, and IntentLock verdicts.

---

## 2. Technology Stack

- **Framework:** React 18 + Vite + TypeScript (Strict Mode)
- **Styling:** Tailwind CSS (Fintech dark navy foundation with electric-blue and violet accents)
- **Icons:** Lucide React
- **Unit Testing:** Vitest (8 automated test cases for business rules)

---

## 3. Running the Application Locally

### Prerequisites
- Node.js (v18+ or v24+)
- npm

### Commands

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run the local development server:**
   ```bash
   npm run dev
   ```
   Open your browser at `http://localhost:5173`.

3. **Run automated unit tests:**
   ```bash
   npm test
   ```

4. **Build for production:**
   ```bash
   npm run build
   ```

5. **Preview production build locally:**
   ```bash
   npm run preview
   ```

---

## 4. Phase 1 Implementation Status

| Feature / Module | Status | Notes |
| :--- | :--- | :--- |
| **Frontend Architecture & Navigation** | ✅ Functional | Responsive dark-theme dashboard, forms, cards, tabs, and modals |
| **Business Rule Evaluation Engine** | ✅ Functional | Complete logic for budget, condition, delivery, and subscription enforcement |
| **Automated Unit Test Suite** | ✅ Functional | 8 tests passing via Vitest |
| **Seller Catalogue Data** | 🔶 Mocked | Controlled sample product catalogue (clearly labeled as demo data) |
| **Negotiation Engine** | 🔶 Mocked | Deterministic 4-turn simulation designed for modular LLM swap in Phase 2 |
| **IntentLock Engine** | 🔶 Mocked | Deterministic compliance verification; disclaims transactional liability |
| **Audit Ledger** | 🔶 Mocked | In-memory session event stream; persistent database planned for Phase 3 |
| **PayPal Sandbox Checkout** | ⏳ Scheduled | Reserved for Phase 4 backend integration |

---

## 5. Directory Structure

```
src/
├── components/
│   ├── audit/           # AuditTimeline.tsx
│   ├── deals/           # DealCard, OfferComparisonCard, OriginalRequirementsCard
│   ├── intentlock/      # VerificationReportCard, CheckDetailItem
│   ├── layout/          # Navbar, Footer
│   ├── negotiation/     # NegotiationTimeline
│   └── ui/              # Badge, Button, StatusIndicator, NotificationBanner
├── data/                # mockOffers.ts, mockProducts.ts, mockAuditEvents.ts
├── lib/
│   ├── __tests__/       # businessRules.test.ts (Vitest suite)
│   ├── currency.ts      # International currency formatting
│   ├── dealScoring.ts   # Total price calculation and constraint scoring
│   ├── mockNegotiation.ts # 4-round deterministic dialogue generator
│   ├── mockVerification.ts # IntentLock verification engine
│   └── validation.ts   # Form input validation
├── pages/               # Dashboard, FindDeal, DealWorkspace, Negotiation, Verification, AuditTrail
├── types/               # deal.ts, offer.ts, negotiation.ts, verification.ts, audit.ts
├── App.tsx
├── index.css
└── main.tsx
```
