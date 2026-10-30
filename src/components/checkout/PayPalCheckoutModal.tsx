import React, { useState } from 'react';
import { UserIntent, CurrencyCode } from '../../types/deal';
import { FinalDeal } from '../../types/negotiation';
import { VerificationReport, UserApprovalRecord } from '../../types/verification';
import { dealmindApi, PayPalCheckoutResponse, PayPalCaptureResponse } from '../../lib/api/client';
import { formatCurrency } from '../../lib/currency';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import {
  ShieldCheck,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Loader2,
  XCircle,
  Truck,
  Building2,
  Key,
  ExternalLink
} from 'lucide-react';

interface PayPalCheckoutModalProps {
  deal: FinalDeal;
  intent: UserIntent;
  report: VerificationReport;
  approvalRecord: UserApprovalRecord | null;
  authorizationToken?: string;
  isServerOnline: boolean;
  onClose: () => void;
  onPaymentSuccess?: (captureResult: PayPalCaptureResponse) => void;
}

export type CheckoutStep =
  | 'READY'
  | 'CREATING_ORDER'
  | 'AWAITING_APPROVAL'
  | 'CAPTURING'
  | 'SUCCESS'
  | 'ERROR'
  | 'CANCELLED';

export const PayPalCheckoutModal: React.FC<PayPalCheckoutModalProps> = ({
  deal,
  intent: _intent,
  report,
  approvalRecord,
  authorizationToken,
  isServerOnline,
  onClose,
  onPaymentSuccess,
}) => {
  const [step, setStep] = useState<CheckoutStep>('READY');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [orderData, setOrderData] = useState<PayPalCheckoutResponse | null>(null);
  const [captureData, setCaptureData] = useState<PayPalCaptureResponse | null>(null);

  const isApproved = approvalRecord?.status === 'APPROVED';
  const isVerified = report.status.toUpperCase() === 'VERIFIED';
  const isEligible = isServerOnline && isVerified && isApproved;

  // 1. Step 1: Create PayPal Order on Backend
  const handleInitiatePayPalOrder = async () => {
    if (!isEligible) {
      setErrorMessage('Checkout is blocked: Deal must be server-verified and human-approved with backend online.');
      setStep('ERROR');
      return;
    }

    setStep('CREATING_ORDER');
    setErrorMessage(null);

    try {
      const res = await dealmindApi.initiateCheckout(deal.dealId, authorizationToken);
      if (res.success && res.data) {
        setOrderData(res.data);
        setStep('AWAITING_APPROVAL');
      } else {
        throw new Error('Failed to create PayPal order');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Checkout initiation failed';
      setErrorMessage(msg);
      setStep('ERROR');
    }
  };

  // 2. Step 2: Buyer confirms in Sandbox -> Server captures order
  const handleApproveAndCapture = async () => {
    if (!orderData) return;

    setStep('CAPTURING');
    setErrorMessage(null);

    try {
      const res = await dealmindApi.capturePayment(deal.dealId, orderData.paypalOrderId);
      if (res.success && res.data) {
        setCaptureData(res.data);
        setStep('SUCCESS');
        if (onPaymentSuccess) {
          onPaymentSuccess(res.data);
        }
      } else {
        throw new Error('Capture failed');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Server capture failed';
      setErrorMessage(msg);
      setStep('ERROR');
    }
  };

  // 3. Buyer Cancels
  const handleCancelCheckout = async () => {
    if (orderData) {
      try {
        await dealmindApi.cancelPayment(deal.dealId, orderData.paypalOrderId);
      } catch {
        // Safe to ignore on frontend cancellation
      }
    }
    setStep('CANCELLED');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-2xl border border-navy-700 bg-navy-900 p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-navy-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-lg shadow-blue-500/20">
              <CreditCard className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <h3 className="text-base font-bold text-white">PayPal Sandbox Checkout</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950/80 text-blue-400 border border-blue-800/60 uppercase font-semibold">
                  Sandbox Mode
                </span>
              </div>
              <p className="text-xs text-slate-400">
                IntentLock-Enforced Payment Gateway: Funds will only be captured after server validation.
              </p>
            </div>
          </div>

          <Button variant="ghost" size="sm" onClick={onClose} className="text-slate-400 hover:text-white">
            ✕
          </Button>
        </div>

        {/* Gate Eligibility Notice if Offline or Unapproved */}
        {!isEligible && (
          <div className="rounded-xl border border-amber-800/50 bg-amber-950/20 p-4 text-xs space-y-2">
            <div className="flex items-center gap-2 font-semibold text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
              <span>Checkout Security Lock Active</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              {!isServerOnline
                ? 'Backend server is offline. Offline demonstrations cannot create or capture PayPal orders.'
                : !isVerified
                ? 'IntentLock has not verified this deal. Unverified or rejected deals cannot proceed to checkout.'
                : 'Explicit human purchase approval is required. Please approve the deal before attempting checkout.'}
            </p>
          </div>
        )}

        {/* Order & Contract Breakdown */}
        <div className="rounded-xl bg-navy-950/90 p-4 border border-navy-800 space-y-3.5 text-xs">
          <div className="flex items-center justify-between border-b border-navy-800/80 pb-2">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-slate-400" />
              Merchant:
            </span>
            <span className="font-medium text-white">{deal.sellerName}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400">Agreed Item:</span>
            <span className="font-medium text-slate-200 truncate max-w-[240px]">{deal.productTitle}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400">Condition:</span>
            <span className="font-medium text-emerald-400 uppercase">{deal.condition}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1">
              <Truck className="h-3 w-3 text-slate-400" />
              Delivery Timeline:
            </span>
            <span className="text-slate-200">{deal.deliveryEstimateDays} business days</span>
          </div>

          <div className="pt-2 border-t border-navy-850 space-y-1.5">
            <div className="flex justify-between text-slate-400">
              <span>Negotiated Item Price:</span>
              <span className="font-mono text-slate-200">{formatCurrency(deal.productPrice, deal.currency)}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Delivery Charges:</span>
              <span className="font-mono text-slate-200">
                {deal.deliveryFee === 0 ? 'FREE' : formatCurrency(deal.deliveryFee, deal.currency)}
              </span>
            </div>
            {deal.otherCharges > 0 && (
              <div className="flex justify-between text-slate-400">
                <span>Other Authorized Fees:</span>
                <span className="font-mono text-slate-200">{formatCurrency(deal.otherCharges, deal.currency)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-navy-800">
              <span>Total Payable:</span>
              <span className="font-mono text-emerald-400 text-base">
                {formatCurrency(deal.totalPayable, deal.currency)}
              </span>
            </div>
          </div>

          {/* Cryptographic Proof Verification Bar */}
          <div className="pt-2.5 border-t border-navy-850/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span className="flex items-center gap-1">
              <Key className="h-3 w-3 text-violet-400" />
              Contract Fingerprint:
            </span>
            <span className="text-violet-300">{(report.dealFingerprint || '').slice(0, 16)}...</span>
          </div>
        </div>

        {/* Dynamic State Machine Progression */}
        {step === 'READY' && isEligible && (
          <div className="space-y-4">
            <div className="rounded-xl border border-blue-500/30 bg-blue-950/20 p-4 text-xs space-y-2">
              <div className="flex items-center gap-2 font-semibold text-blue-300">
                <ShieldCheck className="h-4 w-4 text-blue-400" />
                <span>IntentLock Security Clearance Confirmed</span>
              </div>
              <p className="text-slate-300 leading-relaxed">
                The backend will create a PayPal Sandbox order bound strictly to this deal and approved amount (
                {formatCurrency(deal.totalPayable, deal.currency)}). No live charges will occur.
              </p>
            </div>

            {/* Simulated Official PayPal Sandbox Button */}
            <div className="space-y-2 pt-1">
              <button
                onClick={handleInitiatePayPalOrder}
                className="w-full h-12 rounded-xl bg-[#FFC439] hover:bg-[#F4B92E] text-[#003087] font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-transform hover:scale-[1.01] active:scale-[0.99]"
              >
                <span className="font-black italic text-base">PayPal</span>
                <span className="text-xs uppercase font-bold text-[#0079C1] tracking-wider">Sandbox Checkout</span>
              </button>

              <button
                onClick={handleInitiatePayPalOrder}
                className="w-full h-11 rounded-xl bg-navy-800 hover:bg-navy-750 border border-navy-700 text-slate-200 font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
              >
                <CreditCard className="h-4 w-4 text-slate-400" />
                <span>Debit or Credit Card (Sandbox)</span>
              </button>
            </div>
          </div>
        )}

        {/* Step: Creating Order */}
        {step === 'CREATING_ORDER' && (
          <div className="rounded-xl border border-navy-700 bg-navy-950/80 p-8 text-center space-y-3">
            <Loader2 className="h-8 w-8 text-electric-400 animate-spin mx-auto" />
            <h4 className="text-sm font-semibold text-white">Contacting PayPal Sandbox Gateway...</h4>
            <p className="text-xs text-slate-400">
              Validating contract fingerprint with IntentLock and generating PayPal Order ID.
            </p>
          </div>
        )}

        {/* Step: Awaiting Buyer Approval in Sandbox */}
        {step === 'AWAITING_APPROVAL' && orderData && (
          <div className="rounded-xl border border-blue-500/40 bg-navy-950/90 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-blue-400 font-semibold text-xs">
                <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
                <span>PayPal Order Ready for Approval</span>
              </div>
              <Badge variant="info" size="sm" className="font-mono text-[10px]">
                {orderData.paypalOrderId}
              </Badge>
            </div>

            <div className="p-3 rounded-lg bg-navy-900 border border-navy-800 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Order ID:</span>
                <span className="font-mono text-slate-200 select-all">{orderData.paypalOrderId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Amount Bound:</span>
                <span className="font-mono font-bold text-white">
                  {formatCurrency(orderData.amount, orderData.currency as CurrencyCode)}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-300">
              In a full popup flow, PayPal Sandbox credentials authenticate the buyer. Click below to simulate buyer
              confirmation and instruct the backend to authoritatively capture funds.
            </p>

            {orderData.approvalUrl && (
              <div className="pt-1">
                <a
                  href={orderData.approvalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 underline font-medium"
                >
                  <span>Open PayPal Sandbox Approval Window</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            )}

            <div className="flex items-center gap-3 pt-1">
              <Button
                variant="primary"
                size="md"
                onClick={handleApproveAndCapture}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 font-bold"
              >
                Simulate Buyer Approval & Capture
              </Button>
              <Button variant="outline" size="md" onClick={handleCancelCheckout}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Step: Capturing */}
        {step === 'CAPTURING' && (
          <div className="rounded-xl border border-navy-700 bg-navy-950/80 p-8 text-center space-y-3">
            <Loader2 className="h-8 w-8 text-emerald-400 animate-spin mx-auto" />
            <h4 className="text-sm font-semibold text-white">Authoritatively Capturing Order...</h4>
            <p className="text-xs text-slate-400">
              Backend is validating the single-use token and completing capture with PayPal Sandbox.
            </p>
          </div>
        )}

        {/* Step: Confirmed Success */}
        {step === 'SUCCESS' && captureData && (
          <div className="rounded-xl border border-emerald-500/50 bg-emerald-950/20 p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">PayPal Sandbox Payment Confirmed!</h4>
                <p className="text-xs text-emerald-300/80">Funds successfully secured. Authorization token consumed.</p>
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-navy-950 border border-emerald-900/40 text-xs space-y-2 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">Payment Status:</span>
                <span className="text-emerald-400 font-bold uppercase">{captureData.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">PayPal Capture ID:</span>
                <span className="text-slate-200 select-all">{captureData.captureId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">PayPal Order ID:</span>
                <span className="text-slate-300 select-all">{captureData.paypalOrderId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">Authorized Amount:</span>
                <span className="text-white font-bold">{formatCurrency(captureData.amount, captureData.currency as CurrencyCode)}</span>
              </div>
              {captureData.payerEmail && (
                <div className="flex justify-between">
                  <span className="text-slate-400 font-sans">Sandbox Buyer:</span>
                  <span className="text-slate-300">{captureData.payerEmail}</span>
                </div>
              )}
            </div>

            <Button variant="primary" size="md" onClick={onClose} className="w-full font-semibold">
              Done / Return to Workspace
            </Button>
          </div>
        )}

        {/* Step: Error */}
        {step === 'ERROR' && (
          <div className="rounded-xl border border-rose-500/50 bg-rose-950/20 p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/40">
                <XCircle className="h-6 w-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Checkout Security Exception</h4>
                <p className="text-xs text-rose-300 mt-1 leading-relaxed">
                  {errorMessage || 'A payment or authorization error occurred.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <Button
                variant="secondary"
                size="md"
                onClick={() => setStep('READY')}
                leftIcon={<RotateCcw className="h-4 w-4" />}
                className="w-full"
              >
                Retry Checkout
              </Button>
              <Button variant="ghost" size="md" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        )}

        {/* Step: Cancelled */}
        {step === 'CANCELLED' && (
          <div className="rounded-xl border border-navy-700 bg-navy-950/60 p-5 space-y-3 text-center">
            <h4 className="text-sm font-semibold text-white">Checkout Cancelled</h4>
            <p className="text-xs text-slate-400">You cancelled the PayPal Sandbox checkout. No funds were captured.</p>
            <Button variant="outline" size="sm" onClick={() => setStep('READY')} className="mx-auto">
              Start Over
            </Button>
          </div>
        )}

        {/* Sandbox Notice Footer */}
        <div className="text-[11px] text-slate-500 text-center border-t border-navy-850 pt-3">
          PayPal AI Commerce Hackathon • Sandbox Environment Only • Never input real financial credentials
        </div>
      </div>
    </div>
  );
};
