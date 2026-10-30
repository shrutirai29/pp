import React from 'react';
import { VerificationReport } from '../../types/verification';
import { UserIntent } from '../../types/deal';
import { CheckDetailItem } from './CheckDetailItem';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { formatCurrency } from '../../lib/currency';
import { 
  ShieldCheck, 
  ShieldAlert, 
  AlertTriangle, 
  RotateCcw, 
  CreditCard, 
  Info,
  Lock,
  Layers,
  ArrowRight
} from 'lucide-react';

interface VerificationReportCardProps {
  report: VerificationReport;
  intent: UserIntent;
  onReturnToNegotiation: () => void;
  onReturnToWorkspace: () => void;
}

export const VerificationReportCard: React.FC<VerificationReportCardProps> = ({
  report,
  intent,
  onReturnToNegotiation,
  onReturnToWorkspace,
}) => {
  const isVerified = report.status === 'verified';
  const isRejected = report.status === 'rejected';
  const isNeedsReview = report.status === 'needs_review';

  return (
    <div className="space-y-6">
      {/* IntentLock Verdict Header */}
      <div
        className={`rounded-xl border p-6 shadow-xl ${
          isVerified
            ? 'border-emerald-500/40 bg-gradient-to-r from-navy-900 via-navy-900 to-emerald-950/20'
            : isRejected
            ? 'border-rose-500/40 bg-gradient-to-r from-navy-900 via-navy-900 to-rose-950/20'
            : 'border-amber-500/40 bg-gradient-to-r from-navy-900 via-navy-900 to-amber-950/20'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${
                isVerified
                  ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-400'
                  : isRejected
                  ? 'bg-rose-950/80 border-rose-500/50 text-rose-400'
                  : 'bg-amber-950/80 border-amber-500/50 text-amber-400'
              }`}
            >
              {isVerified ? (
                <ShieldCheck className="h-7 w-7" />
              ) : isRejected ? (
                <ShieldAlert className="h-7 w-7" />
              ) : (
                <AlertTriangle className="h-7 w-7" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  IntentLock™ Security Engine
                </span>
                <span className="text-[10px] text-slate-500 font-mono bg-navy-950 px-1.5 py-0.5 rounded border border-navy-800">
                  Deterministic Audit
                </span>
              </div>

              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-white">
                  Verification Verdict:
                </h2>
                <Badge
                  variant={isVerified ? 'success' : isRejected ? 'danger' : 'warning'}
                  size="md"
                  dot
                  className="text-xs uppercase font-bold tracking-wider"
                >
                  {report.status === 'verified' && 'Deal Verified'}
                  {report.status === 'rejected' && 'Deal Rejected'}
                  {report.status === 'needs_review' && 'Needs Review'}
                </Badge>
              </div>

              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
                {report.summary}
              </p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="rounded-xl bg-navy-950/90 border border-navy-800 px-3.5 py-2.5 text-center">
              <span className="text-[10px] text-slate-400 block uppercase font-medium">Passed</span>
              <span className="text-base font-bold text-emerald-400 font-mono">{report.passedCount}</span>
            </div>

            <div className="rounded-xl bg-navy-950/90 border border-navy-800 px-3.5 py-2.5 text-center">
              <span className="text-[10px] text-slate-400 block uppercase font-medium">Failed</span>
              <span className="text-base font-bold text-rose-400 font-mono">{report.failedCount}</span>
            </div>

            <div className="rounded-xl bg-navy-950/90 border border-navy-800 px-3.5 py-2.5 text-center">
              <span className="text-[10px] text-slate-400 block uppercase font-medium">Uncertain</span>
              <span className="text-base font-bold text-amber-400 font-mono">{report.needsReviewCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Comparison Snapshot: Intent vs Proposed Deal */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-navy-800 bg-navy-900/50 p-4">
          <div className="flex items-center gap-2 mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-navy-800 pb-2">
            <Lock className="h-3.5 w-3.5 text-electric-400" />
            <span>Buyer Non-Negotiable Criteria</span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Product Title:</span>
              <span className="font-medium text-slate-200">{intent.productTitle}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Budget Limit:</span>
              <span className="font-mono font-medium text-slate-200">
                {formatCurrency(intent.maxBudget, intent.currency)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Required Condition:</span>
              <span className="font-medium text-slate-200 uppercase">{intent.requiredCondition}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Delivery Window:</span>
              <span className="font-medium text-slate-200">≤ {intent.maxDeliveryDays} days</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Subscriptions:</span>
              <span className="font-medium text-emerald-400">Strictly Prohibited</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-navy-800 bg-navy-900/50 p-4">
          <div className="flex items-center gap-2 mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-navy-800 pb-2">
            <Layers className="h-3.5 w-3.5 text-violet-400" />
            <span>Final Proposed Contract Terms</span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Merchant:</span>
              <span className="font-medium text-slate-200">{report.sellerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Final Agreed Total:</span>
              <span className="font-mono font-bold text-white">
                {formatCurrency(report.finalPrice, intent.currency)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Item Title:</span>
              <span className="font-medium text-slate-200 truncate max-w-[200px]">
                {report.offerTitle}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Audit Status:</span>
              <span className="font-mono uppercase text-slate-300">{report.status}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Verified At:</span>
              <span className="font-mono text-slate-400 text-[11px]">
                {new Date(report.verifiedAt).toLocaleTimeString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Security Checks Detail List */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-200 flex items-center justify-between">
          <span>Individual Cryptographic Rule Evaluations</span>
          <span className="text-xs text-slate-400 font-normal">
            {report.checks.length} Checks Run
          </span>
        </h3>

        <div className="space-y-3">
          {report.checks.map((chk) => (
            <CheckDetailItem key={chk.id} check={chk} />
          ))}
        </div>
      </div>

      {/* Mandatory Demo Disclaimer Notice (Rule 12) */}
      <div className="rounded-xl bg-navy-950/80 p-4 border border-navy-800/80 text-xs text-slate-400 flex items-start gap-2.5">
        <Info className="h-4 w-4 shrink-0 text-slate-500 mt-0.5" />
        <div>
          <strong className="text-slate-300 block mb-0.5">Hackathon Prototype Notice:</strong>
          <span>{report.disclaimer}</span>
        </div>
      </div>

      {/* Bottom Action Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border border-navy-800 bg-navy-900/60 p-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="md" onClick={onReturnToWorkspace}>
            Back to Workspace
          </Button>

          {(!isVerified || isNeedsReview) && (
            <Button
              variant="secondary"
              size="md"
              onClick={onReturnToNegotiation}
              leftIcon={<RotateCcw className="h-4 w-4" />}
            >
              Return to Negotiation
            </Button>
          )}
        </div>

        <div>
          {isVerified ? (
            <div className="flex items-center gap-3">
              <div className="relative group">
                <Button
                  variant="primary"
                  size="md"
                  disabled={true}
                  leftIcon={<CreditCard className="h-4 w-4" />}
                  rightIcon={<ArrowRight className="h-4 w-4" />}
                  className="bg-navy-800 border-navy-700 text-slate-400 cursor-not-allowed opacity-75"
                >
                  Proceed to PayPal Checkout (Phase 4)
                </Button>
                {/* Tooltip explaining coming in Phase 4 */}
                <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block w-72 rounded-lg bg-navy-950 border border-navy-700 p-2.5 text-xs text-slate-300 shadow-xl z-50">
                  <p className="font-semibold text-white mb-0.5">PayPal Sandbox Checkout</p>
                  <p className="text-[11px] text-slate-400">
                    As specified in Phase 1 scope, checkout integration with PayPal Sandbox will be activated in Phase 4 once the persistent backend is connected.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-rose-400 font-medium flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5" />
              <span>Checkout Disabled: Deal failed non-negotiable IntentLock check.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
