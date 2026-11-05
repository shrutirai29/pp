import React, { useState } from 'react';
import { UserApprovalRecord, VerificationReport } from '../../types/verification';
import { FinalDeal } from '../../types/negotiation';
import { formatCurrency } from '../../lib/currency';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { 
  ShieldCheck, 
  Key, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Lock,
  ArrowRight,
  Loader2
} from 'lucide-react';

interface ApprovalModalProps {
  report: VerificationReport;
  deal: FinalDeal;
  approvalRecord: UserApprovalRecord | null;
  onApprove: () => Promise<void> | void;
  onDecline: () => void;
  onCancel: () => void;
  onProceedToCheckout?: () => void;
  authorizationToken?: string;
  isLoading?: boolean;
  error?: string | null;
}

export const ApprovalModal: React.FC<ApprovalModalProps> = ({
  report,
  deal,
  approvalRecord,
  onApprove,
  onDecline,
  onCancel,
  onProceedToCheckout,
  authorizationToken,
  isLoading = false,
  error = null,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isApproved = approvalRecord?.status === 'APPROVED';
  const isDeclined = approvalRecord?.status === 'DECLINED';
  const isExpired = approvalRecord?.status === 'EXPIRED';
  const isInvalidated = approvalRecord?.status === 'INVALIDATED';

  const isBusy = isLoading || isSubmitting;
  const activeError = error || submitError;

  const handleApproveClick = async () => {
    if (isBusy || isApproved) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await onApprove();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Approval failed. Please check terms and retry.';
      setSubmitError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-2xl border border-navy-700 bg-navy-900 p-6 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-navy-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-electric-950 border border-electric-500/40 text-electric-400">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Explicit Human Purchase Approval
              </h3>
              <p className="text-xs text-slate-400">
                IntentLock Gateway: Requires authorized user action prior to checkout authorization
              </p>
            </div>
          </div>

          <Badge variant={isApproved ? 'success' : isDeclined ? 'danger' : 'info'} size="sm">
            {approvalRecord?.status || 'PENDING'}
          </Badge>
        </div>

        {/* Contract Summary */}
        <div className="rounded-xl bg-navy-950/80 p-4 border border-navy-800 space-y-3 text-xs">
          <div className="flex justify-between items-center text-slate-300">
            <span>Product Title:</span>
            <span className="font-semibold text-white truncate max-w-[260px]">{deal.productTitle}</span>
          </div>

          <div className="flex justify-between items-center text-slate-300">
            <span>Merchant:</span>
            <span className="font-medium text-slate-200">{deal.sellerName}</span>
          </div>

          <div className="flex justify-between items-center text-slate-300">
            <span>Final Agreed Total:</span>
            <span className="font-mono font-bold text-white text-sm">
              {formatCurrency(deal.totalPayable, deal.currency)}
            </span>
          </div>

          <div className="flex justify-between items-center text-slate-300">
            <span>Fulfillment Timeline:</span>
            <span className="text-slate-200">{deal.deliveryEstimateDays} business days</span>
          </div>

          <div className="pt-2 border-t border-navy-850 flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span className="flex items-center gap-1">
              <Key className="h-3 w-3 text-violet-400" />
              Fingerprint:
            </span>
            <span className="text-violet-300">{(report.dealFingerprint || '').slice(0, 20)}...</span>
          </div>
        </div>

        {/* Expiration Notice */}
        {approvalRecord && !isApproved && !isDeclined && !isExpired && !isInvalidated && (
          <div className="flex items-center gap-2 rounded-lg bg-navy-950/50 p-2.5 border border-navy-850 text-xs text-slate-400">
            <Clock className="h-4 w-4 text-amber-400 shrink-0" />
            <span>
              Approval validity window: 15 minutes. Expires at{' '}
              {new Date(approvalRecord.expiresAt).toLocaleTimeString()}.
            </span>
          </div>
        )}

        {/* Active Error Feedback */}
        {activeError && (
          <div className="rounded-xl bg-rose-950/40 border border-rose-700/60 p-4 text-xs text-rose-300 flex items-start gap-2.5 animate-in fade-in">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold block text-rose-200">Approval Failed</span>
              <p className="text-rose-300/90 leading-relaxed">{activeError}</p>
            </div>
          </div>
        )}

        {/* Status Feedback */}
        {isApproved && (
          <div className="rounded-xl bg-emerald-950/30 border border-emerald-700/50 p-4 text-xs space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Purchase Approval Confirmed</span>
            </div>
            <p className="text-slate-300">
              One-time demonstration payment authorization token issued. Single-use and bound strictly to this contract fingerprint.
            </p>
            {authorizationToken && (
              <div className="rounded bg-navy-950 p-2.5 font-mono text-[11px] text-emerald-300 border border-navy-800 flex items-center justify-between">
                <span>
                  Token: {authorizationToken.length > 20
                    ? `${authorizationToken.slice(0, 10)}...${authorizationToken.slice(-6)}`
                    : authorizationToken}
                </span>
                <span className="text-[10px] text-emerald-400 font-sans font-medium bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/60">
                  Signed & Valid
                </span>
              </div>
            )}
          </div>
        )}

        {isDeclined && (
          <div className="rounded-xl bg-rose-950/30 border border-rose-700/50 p-4 text-xs text-rose-300 flex items-start gap-2">
            <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block">Deal Declined</span>
              <span>You have explicitly declined this deal. No payment authorization was granted.</span>
            </div>
          </div>
        )}

        {isInvalidated && (
          <div className="rounded-xl bg-rose-950/30 border border-rose-700/50 p-4 text-xs text-rose-300 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block">Approval Invalidated</span>
              <span>{approvalRecord.invalidationReason || 'Transaction terms were altered after verification.'}</span>
            </div>
          </div>
        )}

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-navy-800">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={isBusy}>
            Close
          </Button>

          {!isApproved && !isDeclined && (
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Button variant="outline" size="md" onClick={onDecline} disabled={isBusy} className="w-full sm:w-auto">
                Decline Deal
              </Button>

              <Button
                variant="primary"
                size="md"
                onClick={handleApproveClick}
                disabled={isBusy}
                leftIcon={isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                rightIcon={!isBusy ? <ArrowRight className="h-4 w-4" /> : undefined}
                className="w-full sm:w-auto bg-gradient-to-r from-electric-500 to-violet-600 font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isBusy ? 'Authorizing & Signing...' : 'Authorize & Approve'}
              </Button>
            </div>
          )}

          {isApproved && (
            <Button
              variant="primary"
              size="md"
              onClick={() => {
                onCancel();
                if (onProceedToCheckout) onProceedToCheckout();
              }}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold"
            >
              Proceed to PayPal Sandbox Checkout
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
