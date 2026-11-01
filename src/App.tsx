import { useState, useEffect } from 'react';
import { UserIntent, Deal } from './types/deal';
import { ProductOffer } from './types/offer';
import { NegotiationSession, FinalDeal } from './types/negotiation';
import { VerificationReport, UserApprovalRecord } from './types/verification';
import { AuditEvent } from './types/audit';

import { DEFAULT_EXAMPLE_INTENT, MOCK_DASHBOARD_DEALS } from './data/mockProducts';
import { SAMPLE_OFFERS } from './data/mockOffers';
import { INITIAL_MOCK_AUDIT_EVENTS } from './data/mockAuditEvents';

import { runIntelligentNegotiation } from './lib/agents/negotiationEngine';
import { verifyDealWithIntentLock } from './lib/mockVerification';
import { rankOffers } from './lib/dealScoring';
import { ApprovalManager } from './lib/intentlock/approvalManager';
import { dealmindApi } from './lib/api/client';

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
  
  // Ranked offers based on active intent
  const [offers, setOffers] = useState<ProductOffer[]>(() => {
    return rankOffers(SAMPLE_OFFERS, DEFAULT_EXAMPLE_INTENT).map((s) => s.offer);
  });
  
  const [selectedOffer, setSelectedOffer] = useState<ProductOffer | null>(offers[0] || null);
  
  // Initialize with initial negotiation result
  const [negotiationResult, setNegotiationResult] = useState(() => {
    return runIntelligentNegotiation(DEFAULT_EXAMPLE_INTENT, SAMPLE_OFFERS[0], SAMPLE_OFFERS);
  });

  const [negotiationSession, setNegotiationSession] = useState<NegotiationSession | null>(
    negotiationResult.session
  );
  const [finalDeal, setFinalDeal] = useState<FinalDeal | null>(
    negotiationResult.finalDeal
  );
  const [negotiationFallbackReason, setNegotiationFallbackReason] = useState<string | undefined>(undefined);

  const [verificationReport, setVerificationReport] = useState<VerificationReport | null>(() => {
    return verifyDealWithIntentLock(DEFAULT_EXAMPLE_INTENT, negotiationResult.finalDeal);
  });

  // Human approval record for verified deal
  const [approvalRecord, setApprovalRecord] = useState<UserApprovalRecord | null>(() => {
    if (verificationReport && String(verificationReport.status).toUpperCase() === 'VERIFIED') {
      try {
        return ApprovalManager.createApprovalRequest(verificationReport);
      } catch {
        return null;
      }
    }
    return null;
  });

  const [authorizationToken, setAuthorizationToken] = useState<string | undefined>(undefined);
  const [isServerOnline, setIsServerOnline] = useState<boolean>(false);
  const [isNegotiating, setIsNegotiating] = useState<boolean>(false);

  // Poll server health on load and synchronize persistent deals
  useEffect(() => {
    let isMounted = true;
    dealmindApi.checkHealth()
      .then((res) => {
        if (isMounted && res && res.status === 'ok') {
          setIsServerOnline(true);
          // Sync server deals if available
          dealmindApi.getDeals()
            .then((srvDealsRes) => {
              if (isMounted && srvDealsRes.success && Array.isArray(srvDealsRes.data) && srvDealsRes.data.length > 0) {
                setDeals(srvDealsRes.data);
                // Recover previously active deal across browser refresh
                const savedDealId = localStorage.getItem('dealmind_active_deal_id');
                const matchedDeal = savedDealId ? srvDealsRes.data.find((d: Deal) => d.id === savedDealId) : srvDealsRes.data[0];
                if (matchedDeal) {
                  handleSelectDeal(matchedDeal);
                }
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => {
        if (isMounted) setIsServerOnline(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Sync server audit trail when viewing audit page
  useEffect(() => {
    if (currentView === 'audit' && isServerOnline && activeIntent?.id) {
      dealmindApi.getAuditTrail(activeIntent.id)
        .then((res) => {
          if (res.success && Array.isArray(res.events) && res.events.length > 0) {
            setAuditEvents((prev) => {
              const existingIds = new Set(prev.map((e) => e.id));
              const newServerEvents = res.events.filter((e) => !existingIds.has(e.id));
              return [...newServerEvents, ...prev];
            });
          }
        })
        .catch(() => {});
    }
  }, [currentView, isServerOnline, activeIntent?.id]);

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

    // Evaluate and rank sample offers against the new intent
    const ranked = rankOffers(SAMPLE_OFFERS, newIntent);
    const rankedOffers = ranked.map((r) => r.offer);
    setOffers(rankedOffers);

    // Select the best eligible offer by default
    const bestEligible = rankedOffers.find((o) => o.eligibilityStatus === 'eligible') || rankedOffers[0];
    setSelectedOffer(bestEligible);

    // Run initial negotiation for state readiness
    const neg = runIntelligentNegotiation(newIntent, bestEligible, rankedOffers);
    setNegotiationResult(neg);
    setNegotiationSession(neg.session);
    setFinalDeal(neg.finalDeal);

    // Invalidate approval state on new deal
    setApprovalRecord(null);
    setAuthorizationToken(undefined);

    // Sync deal to server asynchronously if online, then rank offers on backend
    dealmindApi.createDeal(newIntent, neg.finalDeal, newIntent.productTitle)
      .then(() => {
        setIsServerOnline(true);
        dealmindApi.rankOffers(newIntent.id, SAMPLE_OFFERS)
          .then((rankRes) => {
            if (rankRes.success && Array.isArray(rankRes.data)) {
              const enriched = rankRes.data.map((r: any) => {
                const base = SAMPLE_OFFERS.find((o) => o.id === r.id) || r;
                return {
                  ...base,
                  eligibilityStatus: r.isEligible ? 'eligible' : 'ineligible',
                  eligibilityReasons: r.ineligibilityReasons || [],
                  recommendationScore: r.score,
                  recommendationRank: r.rank,
                };
              });
              setOffers(enriched);
            }
          })
          .catch(() => {});
      })
      .catch(() => setIsServerOnline(false));

    // Create a new Deal record in Dashboard
    const newDeal: Deal = {
      id: newIntent.id,
      title: `${newIntent.productTitle} (${newIntent.requiredCondition.toUpperCase()})`,
      intent: newIntent,
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setDeals((prev) => [newDeal, ...prev]);
    try {
      localStorage.setItem('dealmind_active_deal_id', newDeal.id);
    } catch {}

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
      title: 'Seller Offers Scanned & Ranked',
      description: `Matched ${SAMPLE_OFFERS.length} merchant listings against non-negotiable intent. Best candidate selected based on price savings and reliability.`,
      actor: 'dealmind_agent',
    });

    // Navigate to Deal Workspace
    setCurrentView('workspace');
  };

  // Handler: Select a deal from Dashboard
  const handleSelectDeal = async (deal: Deal) => {
    try {
      localStorage.setItem('dealmind_active_deal_id', deal.id);
    } catch {}
    setActiveIntent(deal.intent);
    const ranked = rankOffers(SAMPLE_OFFERS, deal.intent);
    const rankedOffers = ranked.map((r) => r.offer);
    setOffers(rankedOffers);

    // Find first eligible offer or default
    const eligible = rankedOffers.find((o) => o.eligibilityStatus === 'eligible') || rankedOffers[0];
    setSelectedOffer(eligible);

    // If server is online, fetch authoritative persisted record
    if (isServerOnline) {
      try {
        const res = await dealmindApi.getDeal(deal.id);
        if (res.success && res.data) {
          const srv = res.data;
          if (srv.finalDeal) {
            setFinalDeal(srv.finalDeal);
          }
          if (srv.latestVerification) {
            setVerificationReport(srv.latestVerification);
          }
          if (srv.latestApproval) {
            setApprovalRecord(srv.latestApproval);
          } else {
            setApprovalRecord(null);
          }
          setAuthorizationToken(undefined);
          setCurrentView('workspace');
          return;
        }
      } catch (err) {
        console.warn('Could not fetch deal from server, deriving locally:', err);
      }
    }

    const neg = runIntelligentNegotiation(deal.intent, eligible, rankedOffers);
    setNegotiationResult(neg);
    setNegotiationSession(neg.session);
    setFinalDeal(neg.finalDeal);

    const report = verifyDealWithIntentLock(deal.intent, neg.finalDeal);
    setVerificationReport(report);

    if (String(report.status).toUpperCase() === 'VERIFIED') {
      const appr = ApprovalManager.createApprovalRequest(report);
      setApprovalRecord(appr);
    } else {
      setApprovalRecord(null);
    }
    setAuthorizationToken(undefined);

    setCurrentView('workspace');
  };

  // Handler: When user clicks "Start Negotiation" on an eligible offer in Workspace
  const handleStartNegotiation = async (offer: ProductOffer) => {
    setSelectedOffer(offer);
    setApprovalRecord(null);
    setAuthorizationToken(undefined);
    setIsNegotiating(true);
    setCurrentView('negotiation');

    let neg: any;
    let fallbackMsg: string | undefined = undefined;

    if (isServerOnline) {
      try {
        await dealmindApi.createDeal(activeIntent, undefined, activeIntent.productTitle);
        const srvRes = await dealmindApi.runNegotiation(activeIntent.id, offer.id, offer);
        if (srvRes.success && srvRes.data) {
          neg = srvRes.data;
          setNegotiationFallbackReason(undefined);
        }
      } catch (err: unknown) {
        fallbackMsg = err instanceof Error ? err.message : 'Backend negotiation service unavailable';
        console.warn('Backend LLM negotiation returned error, falling back to local engine:', err);
      }
    }

    if (!neg) {
      neg = runIntelligentNegotiation(activeIntent, offer, offers);
      neg.engineMode = 'deterministic_fallback';
      neg.providerName = 'Local Rule-Based Heuristic Policy';
      setNegotiationFallbackReason(fallbackMsg || 'Backend offline / local fallback mode active');
    }

    setNegotiationResult(neg);
    setNegotiationSession(neg.session);
    setFinalDeal(neg.finalDeal);
    setIsNegotiating(false);

    // Record audit events
    logAuditEvent({
      dealId: activeIntent.id,
      type: 'negotiation_started',
      title: `Autonomous Dialogue Opened with ${offer.sellerName}`,
      description: `DealMind Buyer Agent initiated policy negotiation for "${offer.productTitle}" starting at initial listing price ${offer.currency} ${offer.totalPrice.toLocaleString()}.`,
      actor: 'dealmind_agent',
      metadata: {
        seller: offer.sellerName,
        startingPrice: offer.totalPrice,
      },
    });

    if (neg.success) {
      logAuditEvent({
        dealId: activeIntent.id,
        type: 'counteroffer_received',
        title: `Merchant Agreement Reached: ${offer.currency} ${neg.finalDeal.totalPayable.toLocaleString()} (${neg.finalDeal.roundCount} Rounds)`,
        description: `Concluded ${neg.finalDeal.roundCount}-round protocol with ${offer.currency} ${neg.finalDeal.totalSaved.toLocaleString()} in buyer savings. Delivery: ${neg.finalDeal.deliveryEstimateDays} days.`,
        actor: 'seller_agent',
        metadata: {
          agreedPrice: neg.finalDeal.totalPayable,
          totalSaved: neg.finalDeal.totalSaved,
          rounds: neg.finalDeal.roundCount,
        },
      });
    } else {
      logAuditEvent({
        dealId: activeIntent.id,
        type: 'counteroffer_received',
        title: `Negotiation Terminated: ${neg.stopReason}`,
        description: neg.summary,
        actor: 'seller_agent',
        metadata: {
          stopReason: neg.stopReason,
        },
      });
    }

    setCurrentView('negotiation');
  };

  // Re-run negotiation simulation
  const handleReRunNegotiation = async () => {
    if (!selectedOffer) return;
    setApprovalRecord(null);
    setAuthorizationToken(undefined);
    setIsNegotiating(true);

    let neg: any;
    let fallbackMsg: string | undefined = undefined;

    if (isServerOnline) {
      try {
        const srvRes = await dealmindApi.runNegotiation(activeIntent.id, selectedOffer.id, selectedOffer);
        if (srvRes.success && srvRes.data) {
          neg = srvRes.data;
          setNegotiationFallbackReason(undefined);
        }
      } catch (err: unknown) {
        fallbackMsg = err instanceof Error ? err.message : 'Backend negotiation service unavailable';
        console.warn('Backend LLM re-run error, using local engine:', err);
      }
    }

    if (!neg) {
      neg = runIntelligentNegotiation(activeIntent, selectedOffer, offers);
      neg.engineMode = 'deterministic_fallback';
      neg.providerName = 'Local Rule-Based Heuristic Policy';
      setNegotiationFallbackReason(fallbackMsg || 'Backend offline / local fallback mode active');
    }

    setNegotiationResult(neg);
    setNegotiationSession(neg.session);
    setFinalDeal(neg.finalDeal);
    setIsNegotiating(false);
  };

  // Handler: When user proceeds to IntentLock verification from Negotiation view
  const handleProceedToVerification = async () => {
    if (!finalDeal) return;

    logAuditEvent({
      dealId: activeIntent.id,
      type: 'verification_started',
      title: 'IntentLock Independent Verification Triggered',
      description: 'Auditing complete seller-accepted FinalDeal against original UserIntent and calculating SHA-256 fingerprint.',
      actor: 'intentlock_engine',
    });

    let report: VerificationReport;
    let isServer = false;

    try {
      // 1. Sync deal to backend SQLite
      await dealmindApi.createDeal(activeIntent, finalDeal, activeIntent.productTitle);
      // 2. Perform server-side independent verification
      const verifyRes = await dealmindApi.verifyDeal(activeIntent.id, finalDeal);
      report = verifyRes.report;
      isServer = true;
      setIsServerOnline(true);
    } catch (err) {
      console.warn('Backend server verification unavailable, falling back to client-side IntentLock gateway:', err);
      setIsServerOnline(false);
      report = verifyDealWithIntentLock(activeIntent, finalDeal);
    }

    setVerificationReport(report);

    // Record fingerprint generation
    logAuditEvent({
      dealId: activeIntent.id,
      type: 'fingerprint_generated',
      title: `Contract Fingerprint Computed (${isServer ? 'Server-Enforced' : 'Local'})`,
      description: `Generated SHA-256 fingerprint: ${report.dealFingerprint}`,
      actor: 'intentlock_engine',
      metadata: {
        fingerprint: report.dealFingerprint,
      },
    });

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

    if (String(report.status).toUpperCase() === 'VERIFIED') {
      try {
        if (isServer) {
          const apprRes = await dealmindApi.createApprovalRequest(activeIntent.id, report.id);
          setApprovalRecord(apprRes.approval);
        } else {
          const appr = ApprovalManager.createApprovalRequest(report);
          setApprovalRecord(appr);
        }
      } catch {
        const appr = ApprovalManager.createApprovalRequest(report);
        setApprovalRecord(appr);
      }

      logAuditEvent({
        dealId: activeIntent.id,
        type: 'human_approval_requested',
        title: `Explicit Human Approval Requested (${isServer ? 'Persisted SQLite' : 'Client Gate'})`,
        description: 'Deal verified. Awaiting human confirmation before payment authorization can be granted.',
        actor: 'intentlock_engine',
      });
    } else {
      setApprovalRecord(null);
      if (String(report.status).toUpperCase() === 'REJECTED') {
        logAuditEvent({
          dealId: activeIntent.id,
          type: 'deal_rejected',
          title: 'Deal Rejected by Security Gateway',
          description: report.rejectionReasons?.join('; ') || 'Hard constraint violations detected.',
          actor: 'intentlock_engine',
        });
      } else {
        logAuditEvent({
          dealId: activeIntent.id,
          type: 'review_required',
          title: 'Review Required on Uncertain Items',
          description: report.summary,
          actor: 'intentlock_engine',
        });
      }
    }

    setAuthorizationToken(undefined);

    // Update deal status in list
    setDeals((prev) =>
      prev.map((d) => {
        if (d.intent.id === activeIntent.id || d.id === 'deal-001') {
          return {
            ...d,
            status: report.status.toLowerCase() === 'verified' ? 'verified' : 'rejected',
            updatedAt: new Date().toISOString(),
          };
        }
        return d;
      })
    );

    setCurrentView('intentlock');
  };

  // Handler: User explicitly approves the deal
  const handleUserApprove = async () => {
    if (!approvalRecord || !finalDeal) return;
    try {
      let token: string;
      let updatedApproval: UserApprovalRecord;

      if (isServerOnline) {
        try {
          const res = await dealmindApi.approveDeal(activeIntent.id, approvalRecord.approvalId, finalDeal);
          token = res.authorizationToken;
          updatedApproval = res.approval;
        } catch (serverErr) {
          throw serverErr;
        }
      } else {
        const result = ApprovalManager.approveDeal(approvalRecord, finalDeal);
        token = result.authorizationToken;
        updatedApproval = result.approval;
      }

      setApprovalRecord(updatedApproval);
      setAuthorizationToken(token);

      logAuditEvent({
        dealId: activeIntent.id,
        type: 'approval_granted',
        title: `Human Purchase Approval Granted (${isServerOnline ? 'Server-Enforced Token' : 'Local Token'})`,
        description: `User authorized transaction. Single-use token issued: ${token}`,
        actor: 'user',
        metadata: {
          token,
          fingerprint: approvalRecord.dealFingerprint,
        },
      });
    } catch (err) {
      logAuditEvent({
        dealId: activeIntent.id,
        type: 'approval_invalidated',
        title: 'Approval Invalidation Error',
        description: err instanceof Error ? err.message : 'Approval failed',
        actor: 'intentlock_engine',
      });
    }
  };

  // Handler: User explicitly declines the deal
  const handleUserDecline = async () => {
    if (!approvalRecord) return;
    try {
      if (isServerOnline) {
        const res = await dealmindApi.declineDeal(activeIntent.id, approvalRecord.approvalId);
        setApprovalRecord(res.approval);
      } else {
        const updated = ApprovalManager.declineDeal(approvalRecord);
        setApprovalRecord(updated);
      }
    } catch {
      const updated = ApprovalManager.declineDeal(approvalRecord);
      setApprovalRecord(updated);
    }

    logAuditEvent({
      dealId: activeIntent.id,
      type: 'approval_declined',
      title: 'Human Purchase Approval Declined',
      description: 'User explicitly declined terms. Payment authorization rejected.',
      actor: 'user',
    });
  };

  // Handler: PayPal Sandbox Payment confirmed by backend
  const handlePaymentSuccess = (captureResult: any) => {
    // 1. Update deal status
    setDeals((prev) =>
      prev.map((d) => {
        if (d.intent.id === activeIntent.id || d.id === activeIntent.id || d.id === 'deal-001') {
          return {
            ...d,
            status: 'payment_completed',
            updatedAt: new Date().toISOString(),
          };
        }
        return d;
      })
    );

    // 2. Mark approval as consumed
    if (approvalRecord) {
      setApprovalRecord({
        ...approvalRecord,
        status: 'CONSUMED',
        consumedAt: new Date().toISOString(),
      });
    }

    // 3. Log confirmed audit event
    logAuditEvent({
      dealId: activeIntent.id,
      type: 'paypal_payment_completed',
      title: 'PayPal Sandbox Payment Confirmed & Secured',
      description: `Payment captured successfully via PayPal Sandbox. Capture ID: ${captureResult.captureId}. Transaction secured with IntentLock.`,
      actor: 'paypal_gateway',
      metadata: {
        orderId: captureResult.paypalOrderId,
        captureId: captureResult.captureId,
        amount: captureResult.amount,
        currency: captureResult.currency,
        payer: captureResult.payerEmail,
      },
    });
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
        isServerOnline={isServerOnline}
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
              const fresh = rankOffers(SAMPLE_OFFERS, activeIntent).map((s) => s.offer);
              setOffers(fresh);
            }}
          />
        )}

        {currentView === 'negotiation' && negotiationSession && selectedOffer && (
          <NegotiationPage
            session={negotiationSession}
            intent={activeIntent}
            offer={selectedOffer}
            engineMode={negotiationResult?.engineMode}
            providerName={negotiationResult?.providerName}
            fallbackReason={negotiationFallbackReason}
            isNegotiating={isNegotiating}
            onProceedToVerification={handleProceedToVerification}
            onBackToWorkspace={() => setCurrentView('workspace')}
            onReRunNegotiation={handleReRunNegotiation}
          />
        )}

        {currentView === 'intentlock' && verificationReport && (
          <VerificationPage
            report={verificationReport}
            intent={activeIntent}
            deal={finalDeal || undefined}
            approvalRecord={approvalRecord}
            onApprove={handleUserApprove}
            onDecline={handleUserDecline}
            authorizationToken={authorizationToken}
            isServerOnline={isServerOnline}
            onReturnToNegotiation={() => setCurrentView('negotiation')}
            onReturnToWorkspace={() => setCurrentView('workspace')}
            onPaymentSuccess={handlePaymentSuccess}
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
