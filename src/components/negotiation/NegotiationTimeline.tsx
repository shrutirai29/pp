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
  Info
} from 'lucide-react';
import { Button } from '../ui/Button';

interface NegotiationTimelineProps {
  session: NegotiationSession;
  onProceedToVerification: () => void;
  onBackToWorkspace: () => void;
}

export const NegotiationTimeline: React.FC<NegotiationTimelineProps> = ({
  session,
  onProceedToVerification,
  onBackToWorkspace,
}) => {
  const percentSaved = Math.round((session.totalSaved / session.initialPrice) * 100);

  return (
    <div className="space-y-6">
      {/* Header Price & Savings Summary Bar */}
      <div className="rounded-xl border border-navy-800 bg-gradient-to-r from-navy-900 via-navy-900 to-navy-850 p-5 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                Negotiation Concluded • Deterministic Simulation
              </span>
            </div>
            <h2 className="text-lg font-bold text-white">
              Autonomous Dialogue with {session.sellerName}
            </h2>
            <p className="text-xs text-slate-400">
              4-turn protocol completed. Seller accepted counter-proposal.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-lg bg-navy-950/80 px-4 py-2 border border-navy-800 text-left">
              <span className="text-[11px] text-slate-400 block">Initial Listed Price</span>
              <span className="text-sm font-semibold text-slate-300 line-through font-mono">
                {formatCurrency(session.initialPrice, session.currency)}
              </span>
            </div>

            <div className="rounded-lg bg-navy-950/80 px-4 py-2 border border-electric-500/40 text-left">
              <span className="text-[11px] text-electric-400 block font-medium">Final Agreed Deal</span>
              <span className="text-base font-bold text-white font-mono">
                {formatCurrency(session.currentOfferPrice, session.currency)}
              </span>
            </div>

            <div className="rounded-lg bg-emerald-950/40 px-4 py-2 border border-emerald-700/50 text-left">
              <span className="text-[11px] text-emerald-400 block font-medium flex items-center gap-1">
                <TrendingDown className="h-3 w-3" /> Total Buyer Savings
              </span>
              <span className="text-base font-bold text-emerald-300 font-mono">
                {formatCurrency(session.totalSaved, session.currency)} ({percentSaved}%)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Timeline */}
      <div className="rounded-xl border border-navy-800 bg-navy-900/40 p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-navy-800 pb-3">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-electric-400" />
            Dialogue Transcript & Counter-Offers
          </h3>
          <span className="text-[11px] text-slate-500 font-mono">
            Protocol: DealMind-v1.0 (Mock Simulation)
          </span>
        </div>

        <div className="space-y-4">
          {session.messages.map((msg) => {
            const isBuyer = msg.sender === 'buyer_agent';

            return (
              <div
                key={msg.id}
                className={`flex gap-3.5 ${isBuyer ? 'justify-start' : 'justify-start md:pl-10'}`}
              >
                {/* Avatar Icon */}
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
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
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-white">{msg.senderName}</span>
                      <span className="text-[11px] text-slate-500 font-mono">{msg.timestamp}</span>
                    </div>

                    {msg.proposedPrice !== undefined && (
                      <span className="font-mono text-xs font-semibold px-2.5 py-0.5 rounded-full bg-navy-950 border border-navy-700 text-electric-300">
                        {isBuyer ? 'Buyer Target: ' : 'Seller Offer: '}
                        {formatCurrency(msg.proposedPrice, msg.currency)}
                      </span>
                    )}
                  </div>

                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-3">
                    {msg.text}
                  </p>

                  {/* Highlights */}
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

        {/* Mock Simulation Disclaimer */}
        <div className="rounded-lg bg-navy-950/70 p-3 border border-navy-800/70 flex items-start gap-2 text-xs text-slate-400">
          <Info className="h-4 w-4 shrink-0 text-slate-500 mt-0.5" />
          <span>
            <strong>Deterministic Mock Negotiation:</strong> Responses are generated locally to demonstrate state machine transitions between buyer agent and seller agent without external API reliance. In Phase 2, this connects to an autonomous LLM service.
          </span>
        </div>
      </div>

      {/* Next Step / Action Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border border-navy-800 bg-navy-900/60 p-4">
        <Button variant="outline" onClick={onBackToWorkspace}>
          Back to Offers Workspace
        </Button>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Button
            variant="primary"
            onClick={onProceedToVerification}
            leftIcon={<ShieldCheck className="h-4 w-4" />}
            rightIcon={<ArrowRight className="h-4 w-4" />}
            className="w-full sm:w-auto bg-gradient-to-r from-electric-500 to-violet-600 hover:from-electric-600 hover:to-violet-700 text-white font-semibold"
          >
            Submit to IntentLock™ Verification
          </Button>
        </div>
      </div>
    </div>
  );
};
