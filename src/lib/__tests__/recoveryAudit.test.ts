import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { dealmindApi } from '../api/client';
import { FinalDeal } from '../../types/negotiation';

describe('Frontend Recovery Audit & Client Normalization Tests', () => {
  const originalFetch = globalThis.fetch;
  const storage: Record<string, string> = {};

  beforeEach(() => {
    // Mock localStorage for Node test runner
    (globalThis as any).localStorage = {
      getItem: (k: string) => storage[k] || null,
      setItem: (k: string, v: string) => { storage[k] = String(v); },
      removeItem: (k: string) => { delete storage[k]; },
      clear: () => { Object.keys(storage).forEach(k => delete storage[k]); },
      length: 0,
      key: () => null,
    };

    localStorage.setItem('dealmind_session_token', 'test-session-jwt-token');
    localStorage.setItem('dealmind_user_id', 'usr-test-123');
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete (globalThis as any).localStorage;
    vi.restoreAllMocks();
  });

  const mockFinalDeal: FinalDeal = {
    dealId: 'deal-norm-001',
    originalOfferId: 'off-test-01',
    sellerId: 'seller-01',
    sellerName: 'Premier Merchant',
    productTitle: 'Pro Workstation Laptop',
    condition: 'new',
    productPrice: 6500,
    deliveryFee: 0,
    otherCharges: 0,
    totalPayable: 6500,
    deliveryEstimateDays: 2,
    warrantyMonths: 24,
    hasSubscription: false,
    negotiationStatus: 'agreed',
    roundCount: 2,
    messages: [],
    isAcceptedBySeller: true,
    currency: 'USD',
    totalSaved: 300,
    stopReason: 'agreed',
  };

  it('1. dealmindApi.approveDeal correctly normalizes authorizationToken and approval from backend data wrapper', async () => {
    const mockBackendResponse = {
      success: true,
      data: {
        approvalId: 'appr-srv-789',
        status: 'APPROVED',
        authorizationToken: 'AUTH-SRV-999-SECRET-HEX',
        expiresAt: '2026-11-05T20:00:00Z',
        dealFingerprint: 'FINGERPRINT-SHA256-HEX',
        message: 'Human approval granted.',
      },
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockBackendResponse,
    });

    const result = await dealmindApi.approveDeal('deal-norm-001', 'appr-srv-789', mockFinalDeal);

    expect(result.success).toBe(true);
    // Crucial: token must be top-level and populated
    expect(result.authorizationToken).toBe('AUTH-SRV-999-SECRET-HEX');
    expect(result.approval.approvalId).toBe('appr-srv-789');
    expect(result.approval.status).toBe('APPROVED');
    expect(result.approval.dealFingerprint).toBe('FINGERPRINT-SHA256-HEX');
  });

  it('2. dealmindApi.reconcilePayment sends POST to /api/deals/:id/reconcile and returns normalized data', async () => {
    const mockReconciliationBackendResponse = {
      success: true,
      data: {
        status: 'COMPLETED',
        paymentStatus: 'COMPLETED',
        dealStatus: 'payment_completed',
        paypalOrderId: 'ORDER-PAYPAL-123',
        captureId: 'CAP-PAYPAL-456',
        amount: 6500,
        currency: 'USD',
        message: 'PayPal payment confirmed via reconciliation.',
      },
    };

    let requestedUrl = '';
    let requestMethod = '';

    globalThis.fetch = vi.fn().mockImplementation((url, opts) => {
      requestedUrl = String(url);
      requestMethod = opts?.method || 'GET';
      return Promise.resolve({
        ok: true,
        json: async () => mockReconciliationBackendResponse,
      });
    });

    const res = await dealmindApi.reconcilePayment('deal-norm-001');

    expect(requestedUrl).toContain('/api/deals/deal-norm-001/reconcile');
    expect(requestMethod).toBe('POST');
    expect(res.success).toBe(true);
    expect(res.data.status).toBe('COMPLETED');
    expect(res.data.captureId).toBe('CAP-PAYPAL-456');
    expect(res.data.amount).toBe(6500);
  });

  it('3. dealmindApi.verifyDeal normalizes report from backend data wrapper', async () => {
    const mockVerifyResponse = {
      success: true,
      data: {
        id: 'rep-test-01',
        dealId: 'deal-norm-001',
        status: 'VERIFIED',
        dealFingerprint: 'FP-12345',
        passedCount: 5,
        failedCount: 0,
        needsReviewCount: 0,
        summary: 'All requirements verified.',
        checks: [],
        timestamp: '2026-11-05T12:00:00Z',
      },
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockVerifyResponse,
    });

    const res = await dealmindApi.verifyDeal('deal-norm-001', mockFinalDeal);

    expect(res.success).toBe(true);
    expect(res.report).toBeDefined();
    expect(res.report.status).toBe('VERIFIED');
    expect(res.report.dealFingerprint).toBe('FP-12345');
  });

  it('4. dealmindApi.createApprovalRequest normalizes approval from backend data wrapper', async () => {
    const mockApprRequestResponse = {
      success: true,
      data: {
        id: 'appr-req-999',
        dealId: 'deal-norm-001',
        reportId: 'rep-test-01',
        userId: 'usr-test-123',
        fingerprint: 'FP-12345',
        status: 'PENDING',
        expiresAt: '2026-11-05T20:15:00Z',
        createdAt: '2026-11-05T20:00:00Z',
      },
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockApprRequestResponse,
    });

    const res = await dealmindApi.createApprovalRequest('deal-norm-001', 'rep-test-01');

    expect(res.success).toBe(true);
    expect(res.approval).toBeDefined();
    expect((res.approval as any).id || res.approval.approvalId).toBe('appr-req-999');
    expect(res.approval.status).toBe('PENDING');
  });
});
