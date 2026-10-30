import { useState } from 'react';
import { UserIntent, Deal } from './types/deal';
import { ProductOffer } from './types/offer';
import { NegotiationSession } from './types/negotiation';
import { VerificationReport } from './types/verification';
import { AuditEvent } from './types/audit';

import { DEFAULT_EXAMPLE_INTENT, MOCK_DASHBOARD_DEALS } from './data/mockProducts';
import { SAMPLE_OFFERS } from './data/mockOffers';
import { INITIAL_MOCK_AUDIT_EVENTS } from './data/mockAuditEvents';

import { createDeterministicNegotiationSession } from './lib/mockNegotiation';
import { verifyDealWithIntentLock } from './lib/mockVerification';
import { evaluateOfferEligibility } from './lib/dealScoring';

import { Navbar, NavView } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { DashboardPage } from './pages/DashboardPage';
import { FindDealPage } from './pages/FindDealPage';
import { DealWorkspacePage } from './pages/DealWorkspacePage';
import { NegotiationPage } from './pages/NegotiationPage';
import { VerificationPage } from './pages/VerificationPage';
import { AuditTrailPage } from './pages/AuditTrailPage';

export function App() {
  const [currentView, setCurrentView] = useState<NavView>('dashboard');
  const [deals, setDeals] = useState<Deal[]>(MOCK_DASHBOARD_DEALS);
  const [activeIntent, setActiveIntent] = useState<UserIntent>(DEFAULT_EXAMPLE_INTENT);
  const [offers, setOffers] = useState<ProductOffer[]>(() => {
    // Score sample offers against default intent
    return SAMPLE_OFFERS.map((o) => evaluateOfferEligibility(o, DEFAULT_EXAMPLE_INTENT).offer);
  });
  
  const [selectedOffer, setSelectedOffer] = useState<ProductOffer | null>(offers[0] || null);
  const [negotiationSession, setNegotiationSession] = useState<NegotiationSession | null>(() => {
    return createDeterministicNegotiationSession('deal-001', SAMPLE_OFFERS[0], DEFAULT_EXAMPLE_INTENT);
  });
  const [verificationReport, setVerificationReport] = useState<VerificationReport | null>(() => {
    return verifyDealWithIntentLock(DEFAULT_EXAMPLE_INTENT, SAMPLE_OFFERS[0], 6750);
  });
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>(INITIAL_MOCK_AUDIT_EVENTS);

  // Helper to add audit events
  const logAuditEvent = (event: Omit<AuditEvent, 'id' | 'timestamp' | 'isDemo'>) => {
    const newEvent: AuditEvent = {
      ...event,
      id: `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      isDemo: true,
    };
    setAuditEvents((prev) => [newEvent, ...prev]);
  };

  // Handler: When user submits new purchase criteria in FindDealPage
  const handleIntentSubmit = (newIntent: UserIntent) => {
    setActiveIntent(newIntent);

    // Evaluate sample offers against the new intent
    const scoredOffers = SAMPLE_OFFERS.map((rawOffer) => {
      const evaluation = evaluateOfferEligibility(rawOffer, newIntent);
      return evaluation.offer;
    });
    setOffers(scoredOffers);

    // Create a new Deal record in Dashboard
    const newDeal: Deal = {
      id: `deal-${Date.now()}`,
      title: `${newIntent.productTitle} (${newIntent.requiredCondition.toUpperCase()})`,
      intent: newIntent,
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setDeals((prev) => [newDeal, ...prev]);

    // Record in Audit Trail
    logAuditEvent({
      dealId: newDeal.id,
      type: 'requirements_created',
      title: 'New Buyer Purchase Parameters Registered',
      description: `Registered user query: "${newIntent.rawQuery}". Ceiling: ${newIntent.currency} ${newIntent.maxBudget.toLocaleString()}.`,
      actor: 'user',
      metadata: {
        budget: newIntent.maxBudget,
        condition: newIntent.requiredCondition,
        deliveryDays: newIntent.maxDeliveryDays,
      },
    });

    logAuditEvent({
      dealId: newDeal.id,
      type: 'offers_compared',
      title: 'Seller Offers Scanned & Scored',
      description: `Matched 3 merchant listings against non-negotiable intent.`,
      actor: 'dealmind_agent',
    });

    // Navigate to Deal Workspace
    setCurrentView('workspace');
  };

  // Handler: Select a deal from Dashboard
  const handleSelectDeal = (deal: Deal) => {
    setActiveIntent(deal.intent);
    const scoredOffers = SAMPLE_OFFERS.map((rawOffer) => {
      const evaluation = evaluateOfferEligibility(rawOffer, deal.intent);
      return evaluation.offer;
    });
    setOffers(scoredOffers);

    // Find first eligible offer or default
    const eligible = scoredOffers.find((o) => o.eligibilityStatus === 'eligible') || scoredOffers[0];
    setSelectedOffer(eligible);

    const session = createDeterministicNegotiationSession(deal.id, eligible, deal.intent);
    setNegotiationSession(session);

    const report = verifyDealWithIntentLock(deal.intent, eligible, session.finalPrice);
    setVerificationReport(report);

    setCurrentView('workspace');
  };

  // Handler: When user clicks "Start Negotiation" on an eligible offer in Workspace
  const handleStartNegotiation = (offer: ProductOffer) => {
    setSelectedOffer(offer);

    const session = createDeterministicNegotiationSession(activeIntent.id, offer, activeIntent);
    setNegotiationSession(session);

    // Record audit event
    logAuditEvent({
      dealId: activeIntent.id,
      type: 'negotiation_started',
      title: `Autonomous Negotiation Channel Opened with ${offer.sellerName}`,
      description: `DealMind Buyer Agent initiated dialogue for "${offer.productTitle}" starting at initial listing price ${offer.currency} ${offer.totalPrice.toLocaleString()}.`,
      actor: 'dealmind_agent',
      metadata: {
        seller: offer.sellerName,
        startingPrice: offer.totalPrice,
      },
    });

    logAuditEvent({
      dealId: activeIntent.id,
      type: 'counteroffer_received',
      title: `Merchant Counter-Offer Reached: ${offer.currency} ${session.currentOfferPrice.toLocaleString()}`,
      description: `Completed 4-round protocol with ${session.totalSaved.toLocaleString()} ${offer.currency} savings.`,
      actor: 'seller_agent',
      metadata: {
        agreedPrice: session.currentOfferPrice,
        totalSaved: session.totalSaved,
      },
    });

    setCurrentView('negotiation');
  };

  // Handler: When user proceeds to IntentLock verification from Negotiation view
  const handleProceedToVerification = () => {
    if (!selectedOffer || !negotiationSession) return;

    const report = verifyDealWithIntentLock(
      activeIntent,
      selectedOffer,
      negotiationSession.currentOfferPrice
    );
    setVerificationReport(report);

    // Record audit event
    logAuditEvent({
      dealId: activeIntent.id,
      type: 'verification_completed',
      title: `IntentLock Verification Completed: ${report.status.toUpperCase()}`,
      description: report.summary,
      actor: 'intentlock_engine',
      metadata: {
        status: report.status,
        passedChecks: report.passedCount,
        failedChecks: report.failedCount,
        needsReview: report.needsReviewCount,
      },
    });

    // Update deal status in list
    setDeals((prev) =>
      prev.map((d) => {
        if (d.intent.id === activeIntent.id || d.id === 'deal-001') {
          return {
            ...d,
            status: report.status === 'verified' ? 'verified' : 'rejected',
            updatedAt: new Date().toISOString(),
          };
        }
        return d;
      })
    );

    setCurrentView('intentlock');
  };

  // Reset demo events
  const handleResetAuditEvents = () => {
    setAuditEvents(INITIAL_MOCK_AUDIT_EVENTS);
  };

  return (
    <div className="min-h-screen flex flex-col bg-navy-950 text-slate-100">
      {/* Top Navbar */}
      <Navbar
        currentView={currentView}
        onNavigate={setCurrentView}
        activeDealTitle={activeIntent.productTitle}
        isDealActive={true}
      />

      {/* Main Content View Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentView === 'dashboard' && (
          <DashboardPage
            deals={deals}
            onSelectDeal={handleSelectDeal}
            onNewDeal={() => setCurrentView('find-deal')}
            onViewAudit={() => setCurrentView('audit')}
          />
        )}

        {currentView === 'find-deal' && (
          <FindDealPage
            onSubmit={handleIntentSubmit}
            onCancel={() => setCurrentView('dashboard')}
          />
        )}

        {currentView === 'workspace' && (
          <DealWorkspacePage
            intent={activeIntent}
            offers={offers}
            onStartNegotiation={handleStartNegotiation}
            onEditIntent={() => setCurrentView('find-deal')}
            onResetOffers={() => {
              const fresh = SAMPLE_OFFERS.map(
                (o) => evaluateOfferEligibility(o, activeIntent).offer
              );
              setOffers(fresh);
            }}
          />
        )}

        {currentView === 'negotiation' && negotiationSession && selectedOffer && (
          <NegotiationPage
            session={negotiationSession}
            intent={activeIntent}
            offer={selectedOffer}
            onProceedToVerification={handleProceedToVerification}
            onBackToWorkspace={() => setCurrentView('workspace')}
          />
        )}

        {currentView === 'intentlock' && verificationReport && (
          <VerificationPage
            report={verificationReport}
            intent={activeIntent}
            onReturnToNegotiation={() => setCurrentView('negotiation')}
            onReturnToWorkspace={() => setCurrentView('workspace')}
          />
        )}

        {currentView === 'audit' && (
          <AuditTrailPage
            events={auditEvents}
            onResetEvents={handleResetAuditEvents}
            onBackToDashboard={() => setCurrentView('dashboard')}
          />
        )}
      </main>

      {/* App Footer */}
      <Footer />
    </div>
  );
}

export default App;
