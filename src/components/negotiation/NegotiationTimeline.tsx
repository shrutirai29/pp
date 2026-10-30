import React from 'react';
import { NegotiationSession } from '../../types/negotiation';
import { formatCurrency } from '../../lib/currency';
import { 
  Bot, 
  Store, 
  CheckCircle, 
  TrendingDown, 
  ShieldCheck, 
  Sparkles,
  ArrowRight,
  Info,
  XCircle,
  HelpCircle,
  Layers,
  Clock,
  Shield
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

interface NegotiationTimelineProps {
  session: NegotiationSession;
  engineMode?: 'live_llm' | 'mock_llm' | 'deterministic_fallback';
  providerName?: string;
  onProceedToVerification: () => void;
  onBackToWorkspace: () => void;
  onReRunNegotiation?: () => void;
}

export const NegotiationTimeline: React.FC<NegotiationTimelineProps> = ({
  session,
  engineMode,
  providerName,
  onProceedToVerification,
  onBackToWorkspace,
  onReRunNegotiation,
}) => {
  const isAgreed = session.status === 'agreed';
  const percentSaved = session.initialPrice > 0 
    ? Math.round((session.totalSaved / session.initialPrice) * 100) 
    : 0;

  const finalDeal = session.finalDeal;
  const roundCount = finalDeal?.roundCount ?? session.round;

  return (
    <div className="space-y-6">
      {/* Header Price & Savings Summary Bar */}
      <div
        className={`rounded-xl border p-5 shadow-lg transition-all ${
          isAgreed
            ? 'border-emerald-500/30 bg-gradient-to-r from-navy-900 via-navy-900 to-emerald-950/20'
            : 'border-rose-500/30 bg-gradient-to-r from-navy-900 via-navy-900 to-rose-950/20'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`h-2 w-2 rounded-full ${
                  isAgreed ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                }`}
              />
              <span
                className={`text-xs font-semibold uppercase tracking-wider ${
                  isAgreed ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {isAgreed
                  ? `Commercial Agreement Reached (${roundCount} Rounds) • Awaiting IntentLock Audit`
                  : `Negotiation Ended • Unsuccessful (${session.finalDeal?.stopReason || 'Rejected'})`}
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-navy-950 border border-navy-800 text-slate-400">
                Simulated Seller Agent
              </span>
              {engineMode === 'live_llm' ? (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-electric-950 border border-electric-500/50 text-electric-300 font-semibold">
                  Live LLM Agent ({providerName || 'backend'})
                </span>
              ) : engineMode === 'mock_llm' ? (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/80 border border-amber-600/50 text-amber-300">
                  Mock LLM Mode (Offline Dev)
                </span>
              ) : (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-400">
                  Deterministic Policy Fallback
                </span>
              )}
            </div>

            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              Autonomous Dialogue with {session.sellerName}
            </h2>
            <p className="text-xs text-slate-400">
              {isAgreed
                ? `Seller agreed to terms. NOTE: Negotiation acceptance does not equal payment eligibility. IntentLock independent verification is required.`
                : `DealMind Buyer Agent protected buyer non-negotiables. Negotiation stopped without price convergence.`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-lg bg-navy-950/80 px-4 py-2 border border-navy-800 text-left">
              <span className="text-[11px] text-slate-400 block">Initial Listed Total</span>
              <span className="text-sm font-semibold text-slate-300 line-through font-mono">
                {formatCurrency(session.initialPrice, session.currency)}
              </span>
            </div>

            <div
              className={`rounded-lg bg-navy-950/80 px-4 py-2 border text-left ${
                isAgreed ? 'border-electric-500/40' : 'border-rose-700/40'
              }`}
            >
              <span className="text-[11px] text-slate-400 block font-medium">
                {isAgreed ? 'Final Agreed Total' : 'Last Proposed Total'}
              </span>
              <span className="text-base font-bold text-white font-mono">
                {formatCurrency(session.currentOfferPrice, session.currency)}
              </span>
            </div>

            {isAgreed && (
              <div className="rounded-lg bg-emerald-950/40 px-4 py-2 border border-emerald-700/50 text-left">
                <span className="text-[11px] text-emerald-400 block font-medium flex items-center gap-1">
                  <TrendingDown className="h-3 w-3" /> Total Buyer Savings
                </span>
                <span className="text-base font-bold text-emerald-300 font-mono">
                  {formatCurrency(session.totalSaved, session.currency)} ({percentSaved}%)
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chat Timeline */}
      <div className="rounded-xl border border-navy-800 bg-navy-900/40 p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-navy-800 pb-3">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-electric-400" />
            Autonomous Dialogue & Decision Rationale Stream
          </h3>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-slate-500 font-mono">
              Engine: Modular Multi-Agent Protocol (Max 5 Rounds)
            </span>
            {onReRunNegotiation && (
              <button
                onClick={onReRunNegotiation}
                className="text-xs text-electric-400 hover:text-electric-300 underline"
              >
                Re-Run Simulation
              </button>
            )}
          </div>
        </div>

        {/* Message Stream */}
        <div className="space-y-4">
          {session.messages.map((msg) => {
            const isBuyer = msg.sender === 'buyer_agent';
            const isSystem = msg.sender === 'system';

            if (isSystem) {
              return (
                <div
                  key={msg.id}
                  className="rounded-xl border border-navy-850 bg-navy-950/80 p-3.5 text-xs text-slate-400 flex items-start gap-2.5"
                >
                  <Info className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-200 block mb-0.5">{msg.senderName}</span>
                    <p>{msg.text}</p>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={`flex gap-3.5 ${isBuyer ? 'justify-start' : 'justify-start md:pl-8'}`}
              >
                {/* Avatar Icon */}
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border shadow-sm ${
                    isBuyer
                      ? 'bg-electric-950/80 border-electric-500/40 text-electric-400'
                      : 'bg-violet-950/80 border-violet-500/40 text-violet-400'
                  }`}
                >
                  {isBuyer ? <Bot className="h-5 w-5" /> : <Store className="h-5 w-5" />}
                </div>

                {/* Message Bubble */}
                <div
                  className={`flex-1 rounded-xl border p-4 text-sm transition-all ${
                    isBuyer
                      ? 'bg-navy-900/90 border-navy-700/80 text-slate-200'
                      : 'bg-navy-850/90 border-navy-700/60 text-slate-200'
                  }`}
                >
                  {/* Top Bar: Sender Name, Round & Action */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-white">{msg.senderName}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-navy-950 text-slate-400 border border-navy-800">
                        Round {msg.round}
                      </span>
                      {msg.action && (
                        <Badge
                          variant={
                            msg.action === 'accept'
                              ? 'success'
                              : msg.action === 'reject'
                              ? 'danger'
                              : msg.action === 'counter'
                              ? 'warning'
                              : 'info'
                          }
                          size="sm"
                        >
                          {msg.action.toUpperCase()}
                        </Badge>
                      )}
                      <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">
                        {msg.timestamp}
                      </span>
                    </div>

                    {msg.proposedPrice !== undefined && (
                      <span className="font-mono text-xs font-semibold px-2.5 py-0.5 rounded-full bg-navy-950 border border-navy-700 text-electric-300">
                        {isBuyer ? 'Bid: ' : 'Ask: '}
                        {formatCurrency(msg.proposedPrice, msg.currency)}
                      </span>
                    )}
                  </div>

                  {/* Itemized Financial Breakdown (Decimal-safe recalculation) */}
                  {msg.terms && (
                    <div className="mb-2.5 rounded-md bg-navy-950/70 px-3 py-1.5 border border-navy-800 text-[11px] font-mono text-slate-400 flex flex-wrap items-center gap-2">
                      <span>Item: <strong className="text-slate-200">{formatCurrency(msg.terms.productPrice, msg.currency)}</strong></span>
                      <span>+</span>
                      <span>Delivery: <strong className="text-slate-200">{formatCurrency(msg.terms.deliveryFee, msg.currency)}</strong></span>
                      {msg.terms.otherCharges > 0 && (
                        <>
                          <span>+</span>
                          <span>Other: <strong className="text-slate-200">{formatCurrency(msg.terms.otherCharges, msg.currency)}</strong></span>
                        </>
                      )}
                      <span>=</span>
                      <span className="text-electric-300 font-bold">Total: {formatCurrency(msg.terms.totalPayable, msg.currency)}</span>
                    </div>
                  )}

                  {/* Message Prose */}
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-3">
                    {msg.text}
                  </p>

                  {/* Decision Rationale Explanation (Explainable AI Commerce) */}
                  {msg.decisionRationale && (
                    <div className="mb-3 rounded-lg bg-navy-950/80 p-2.5 border border-navy-850 text-xs">
                      <div className="flex items-center gap-1.5 font-semibold text-[11px] text-slate-400 mb-0.5">
                        <HelpCircle className="h-3 w-3 text-electric-400" />
                        <span>Agent Strategic Rationale:</span>
                      </div>
                      <p className="text-[11px] text-slate-300 italic">
                        {msg.decisionRationale}
                      </p>
                    </div>
                  )}

                  {/* Non-Price Terms Highlights */}
                  {msg.termsHighlights && msg.termsHighlights.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-2 border-t border-navy-800/80">
                      {msg.termsHighlights.map((term, tIdx) => (
                        <span
                          key={tIdx}
                          className="inline-flex items-center gap-1 text-[10px] font-mono rounded bg-navy-950/90 px-2 py-0.5 text-slate-400 border border-navy-800"
                        >
                          <CheckCircle className="h-2.5 w-2.5 text-emerald-400" />
                          {term}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Structured Final Deal Summary Card */}
        {finalDeal && (
          <div className="mt-6 rounded-xl border border-navy-700/80 bg-navy-950/90 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-navy-800 pb-3">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-electric-400" />
                <h4 className="text-xs sm:text-sm font-semibold text-white">
                  Structured Final Deal Agreement (Ready for IntentLock)
                </h4>
              </div>
              <Badge variant={isAgreed ? 'success' : 'danger'} size="sm" dot>
                {isAgreed ? 'Seller Accepted' : 'Unaccepted / Rejected'}
              </Badge>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="rounded-lg bg-navy-900/60 p-2.5 border border-navy-850">
                <span className="text-[10px] text-slate-400 block mb-0.5">Base Product Price</span>
                <span className="font-mono font-semibold text-white">
                  {formatCurrency(finalDeal.productPrice, finalDeal.currency)}
                </span>
              </div>

              <div className="rounded-lg bg-navy-900/60 p-2.5 border border-navy-850">
                <span className="text-[10px] text-slate-400 block mb-0.5">Fulfillment Delivery Fee</span>
                <span className="font-mono font-semibold text-white">
                  {finalDeal.deliveryFee === 0 ? 'Free (Waived)' : formatCurrency(finalDeal.deliveryFee, finalDeal.currency)}
                </span>
              </div>

              <div className="rounded-lg bg-navy-900/60 p-2.5 border border-navy-850">
                <span className="text-[10px] text-slate-400 block mb-0.5">Other Mandatory Charges</span>
                <span className="font-mono font-semibold text-white">
                  {finalDeal.otherCharges === 0 ? '₹0.00' : formatCurrency(finalDeal.otherCharges, finalDeal.currency)}
                </span>
              </div>

              <div className="rounded-lg bg-navy-900/60 p-2.5 border border-electric-500/30">
                <span className="text-[10px] text-electric-400 block mb-0.5 font-medium">Total Payable Amount</span>
                <span className="font-mono font-bold text-white text-sm">
                  {formatCurrency(finalDeal.totalPayable, finalDeal.currency)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
              <div className="flex items-center gap-1.5 text-slate-300">
                <Clock className="h-3.5 w-3.5 text-slate-500" />
                <span>Delivery: <strong>{finalDeal.deliveryEstimateDays} days</strong></span>
              </div>

              <div className="flex items-center gap-1.5 text-slate-300">
                <Shield className="h-3.5 w-3.5 text-slate-500" />
                <span>Warranty: <strong>{finalDeal.warrantyMonths ? `${finalDeal.warrantyMonths} mo` : 'Unspecified'}</strong></span>
              </div>

              <div className="flex items-center gap-1.5 text-slate-300">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                <span>Condition: <strong className="uppercase">{finalDeal.condition}</strong></span>
              </div>

              <div className="flex items-center gap-1.5 text-slate-300">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                <span>Subscriptions: <strong>{finalDeal.hasSubscription ? 'Yes' : 'None'}</strong></span>
              </div>
            </div>
          </div>
        )}

        {/* Demo Disclaimer */}
        <div className="rounded-lg bg-navy-950/70 p-3 border border-navy-800/70 flex items-start gap-2 text-xs text-slate-400">
          <Info className="h-4 w-4 shrink-0 text-slate-500 mt-0.5" />
          <span>
            <strong>Simulated Seller Agent Policy:</strong> Sellers negotiate using private reservation prices and behavior profiles (Flexible, Strict, Conditional). DealMind does not connect to live retail APIs in Phase 2.
          </span>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border border-navy-800 bg-navy-900/60 p-4">
        <Button variant="outline" onClick={onBackToWorkspace}>
          Back to Offers Workspace
        </Button>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {isAgreed ? (
            <Button
              variant="primary"
              onClick={onProceedToVerification}
              leftIcon={<ShieldCheck className="h-4 w-4" />}
              rightIcon={<ArrowRight className="h-4 w-4" />}
              className="w-full sm:w-auto bg-gradient-to-r from-electric-500 to-violet-600 hover:from-electric-600 hover:to-violet-700 text-white font-semibold"
            >
              Verify Final Deal with IntentLock™
            </Button>
          ) : (
            <div className="flex items-center gap-2 text-xs text-rose-400">
              <XCircle className="h-4 w-4 shrink-0" />
              <span>Negotiation failed to reach agreement. Select another offer to re-negotiate.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
