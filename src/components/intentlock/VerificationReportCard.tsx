import React, { useState } from 'react';
import { VerificationReport, UserApprovalRecord } from '../../types/verification';
import { UserIntent } from '../../types/deal';
import { FinalDeal } from '../../types/negotiation';
import { CheckDetailItem } from './CheckDetailItem';
import { ApprovalModal } from './ApprovalModal';
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
  Key,
  Copy,
  Check,
  HelpCircle
} from 'lucide-react';

interface VerificationReportCardProps {
  report: VerificationReport;
  intent: UserIntent;
  deal?: FinalDeal;
  approvalRecord?: UserApprovalRecord | null;
  onApprove?: () => void;
  onDecline?: () => void;
  authorizationToken?: string;
  onReturnToNegotiation: () => void;
  onReturnToWorkspace: () => void;
}

export const VerificationReportCard: React.FC<VerificationReportCardProps> = ({
  report,
  intent,
  deal,
  approvalRecord,
  onApprove,
  onDecline,
  authorizationToken,
  onReturnToNegotiation,
  onReturnToWorkspace,
}) => {
  const [copiedFingerprint, setCopiedFingerprint] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);

  const isVerified = report.status.toUpperCase() === 'VERIFIED';
  const isRejected = report.status.toUpperCase() === 'REJECTED';
  const isNeedsReview = report.status.toUpperCase() === 'NEEDS_REVIEW';

  const isApproved = approvalRecord?.status === 'APPROVED';

  const handleCopyFingerprint = () => {
    if (report.dealFingerprint) {
      navigator.clipboard?.writeText(report.dealFingerprint);
      setCopiedFingerprint(true);
      setTimeout(() => setCopiedFingerprint(false), 2000);
    }
  };

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
                  IntentLock™ Transaction Security Gateway
                </span>
                <span className="text-[10px] text-slate-500 font-mono bg-navy-950 px-1.5 py-0.5 rounded border border-navy-800">
                  Phase 4 Persistent Security Gateway
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
                  {report.status.toUpperCase()}
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
              <span className="text-[10px] text-slate-400 block uppercase font-medium">Review</span>
              <span className="text-base font-bold text-amber-400 font-mono">{report.needsReviewCount}</span>
            </div>
          </div>
        </div>

        {/* SHA-256 Transaction Fingerprint Bar */}
        {report.dealFingerprint && (
          <div className="mt-4 pt-3 border-t border-navy-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 font-mono text-[11px] text-slate-400">
              <Key className="h-3.5 w-3.5 text-violet-400 shrink-0" />
              <span className="text-slate-500 font-sans">SHA-256 Contract Fingerprint:</span>
              <span className="text-violet-300 break-all select-all font-mono">
                {report.dealFingerprint}
              </span>
            </div>

            <button
              onClick={handleCopyFingerprint}
              className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-white px-2 py-0.5 rounded bg-navy-950 border border-navy-800 hover:border-slate-600 transition-colors shrink-0"
            >
              {copiedFingerprint ? (
                <>
                  <Check className="h-3 w-3 text-emerald-400" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  <span>Copy Hash</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Human Approval Status Card if Verified */}
      {isVerified && (
        <div className="rounded-xl border border-electric-500/30 bg-navy-900/60 p-5 space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-electric-500/20 text-electric-400 border border-electric-500/30">
                <Lock className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Explicit Human Authorization Gate</h3>
                <p className="text-xs text-slate-400">
                  Buyer agent agreement does NOT authorize payment. Explicit human confirmation is required.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant={isApproved ? 'success' : 'warning'} size="sm" dot>
                {isApproved ? 'Human Approved' : 'Approval Pending'}
              </Badge>

              <Button
                variant={isApproved ? 'outline' : 'primary'}
                size="sm"
                onClick={() => setShowApprovalModal(true)}
              >
                {isApproved ? 'View Authorization Token' : 'Review & Authorize Deal'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection / Review Required Callout */}
      {isRejected && report.rejectionReasons && report.rejectionReasons.length > 0 && (
        <div className="rounded-xl border border-rose-800/40 bg-rose-950/20 p-4 space-y-2 text-xs">
          <div className="flex items-center gap-2 font-semibold text-rose-300">
            <ShieldAlert className="h-4 w-4 text-rose-400" />
            <span>Explicit Rejection Reasons:</span>
          </div>
          <ul className="list-disc pl-5 space-y-1 text-rose-200/90 text-[11px]">
            {report.rejectionReasons.map((reason, idx) => (
              <li key={idx}>{reason}</li>
            ))}
          </ul>
        </div>
      )}

      {isNeedsReview && (
        <div className="rounded-xl border border-amber-800/40 bg-amber-950/20 p-4 space-y-2 text-xs">
          <div className="flex items-center gap-2 font-semibold text-amber-300">
            <HelpCircle className="h-4 w-4 text-amber-400" />
            <span>Uncertain / Missing Evidence Items:</span>
          </div>
          <p className="text-[11px] text-amber-200/90 leading-relaxed">
            IntentLock flags missing information (e.g. unspecified warranty or subscription terms) as Needs Review. Missing evidence is never automatically approved.
          </p>
        </div>
      )}

      {/* Comparison Snapshot: Intent vs Proposed Deal */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-navy-800 bg-navy-900/50 p-4">
          <div className="flex items-center gap-2 mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-navy-800 pb-2">
            <Lock className="h-3.5 w-3.5 text-electric-400" />
            <span>Original Immutable Buyer Intent</span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Target Product:</span>
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
            <span>Final Negotiated Deal Contract</span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Merchant:</span>
              <span className="font-medium text-slate-200">{report.sellerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Total Payable Amount:</span>
              <span className="font-mono font-bold text-white">
                {formatCurrency(report.finalPrice, intent.currency)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Agreed Product Title:</span>
              <span className="font-medium text-slate-200 truncate max-w-[200px]">
                {report.offerTitle}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Audit Status:</span>
              <span className="font-mono uppercase text-slate-300">{report.status}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Verified Timestamp:</span>
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
          <span>Independent Gateway Verification Checks</span>
          <span className="text-xs text-slate-400 font-normal">
            {report.checks.length} Rule Checks Evaluated
          </span>
        </h3>

        <div className="space-y-3">
          {report.checks.map((chk) => (
            <CheckDetailItem key={chk.id} check={chk} />
          ))}
        </div>
      </div>

      {/* Realistic Technical Notice */}
      <div className="rounded-xl bg-navy-950/80 p-4 border border-navy-800/80 text-xs text-slate-400 flex items-start gap-2.5">
        <Info className="h-4 w-4 shrink-0 text-slate-500 mt-0.5" />
        <div>
          <strong className="text-slate-300 block mb-0.5">Prototype Security Notice:</strong>
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
              <Button
                variant={isApproved ? 'outline' : 'primary'}
                size="md"
                onClick={() => setShowApprovalModal(true)}
                leftIcon={<Lock className="h-4 w-4" />}
              >
                {isApproved ? 'Authorization Token Ready' : 'Approve Deal & Authorize'}
              </Button>

              <div className="relative group">
                <Button
                  variant="primary"
                  size="md"
                  disabled={true}
                  leftIcon={<CreditCard className="h-4 w-4" />}
                  className="bg-navy-800 border-navy-700 text-slate-400 cursor-not-allowed opacity-75"
                >
                  Proceed to PayPal Checkout (Phase 5)
                </Button>
                <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block w-72 rounded-lg bg-navy-950 border border-navy-700 p-2.5 text-xs text-slate-300 shadow-xl z-50">
                  <p className="font-semibold text-white mb-0.5">PayPal Sandbox Checkout</p>
                  <p className="text-[11px] text-slate-400">
                    PayPal checkout is reserved for future integration. Single-use transaction authorization token is cryptographically signed and stored in SQLite.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-rose-400 font-medium flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5" />
              <span>Checkout Disabled: Deal failed IntentLock security gateway checks.</span>
            </div>
          )}
        </div>
      </div>

      {/* Modal for Explicit Human Approval */}
      {showApprovalModal && deal && (
        <ApprovalModal
          report={report}
          deal={deal}
          approvalRecord={approvalRecord || null}
          onApprove={() => {
            if (onApprove) onApprove();
          }}
          onDecline={() => {
            if (onDecline) onDecline();
          }}
          onCancel={() => setShowApprovalModal(false)}
          authorizationToken={authorizationToken}
        />
      )}
    </div>
  );
};
