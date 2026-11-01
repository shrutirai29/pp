import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { DatabaseSync } from '../src/db/sqliteAdapter.js';
import { initDatabase } from '../src/db/database.js';
import { createApp } from '../src/app.js';
import { EnvConfig } from '../src/config/env.js';
import { UserIntent, FinalDeal } from '../src/schemas/dealSchemas.js';
import { authHeader } from './authTestHelper.js';

const testConfig: EnvConfig = {
  PORT: 4001,
  NODE_ENV: 'test',
  CORS_ORIGIN: '*',
  DATABASE_PATH: ':memory:',
  APPROVAL_VALIDITY_SECONDS: 900,
  TOKEN_HMAC_SECRET: 'test_secret_key_123',
};

const mockIntent: UserIntent = {
  id: 'deal-test-001',
  rawQuery: 'Samsung 980 1TB SSD under ₹8,000, new condition, delivery in 3 days, no subscriptions.',
  productTitle: 'Samsung 980 1TB NVMe SSD',
  maxBudget: 8000,
  currency: 'INR',
  requiredCondition: 'new',
  maxDeliveryDays: 3,
  requiredWarrantyMonths: 12,
  prohibitSubscriptions: true,
  requireAllFeesIncluded: true,
  hardConstraints: ['budget', 'condition', 'delivery', 'no_subscription', 'warranty'],
  flexiblePreferences: ['seller_rating'],
  createdAt: '2026-10-30T10:00:00Z',
};

const mockValidFinalDeal: FinalDeal = {
  dealId: 'deal-test-001',
  originalOfferId: 'off-techhaven-01',
  sellerId: 'off-techhaven-01',
  sellerName: 'TechHaven Direct',
  productTitle: 'Samsung 980 1TB NVMe SSD',
  condition: 'new',
  productPrice: 6750,
  deliveryFee: 0,
  otherCharges: 0,
  totalPayable: 6750,
  deliveryEstimateDays: 2,
  warrantyMonths: 60,
  hasSubscription: false,
  negotiationStatus: 'agreed',
  roundCount: 4,
  messages: [],
  isAcceptedBySeller: true,
  currency: 'INR',
  totalSaved: 549,
  stopReason: 'agreed',
};

describe('Phase 4: Server-Enforced IntentLock Gateway & Persistence', () => {
  let db: DatabaseSync;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    db = initDatabase(':memory:');
    app = createApp(db, testConfig);
  });

  // 1. Valid deal creation
  it('1. Valid deal creation stores deal record with UserIntent', async () => {
    const res = await request(app)
      .post('/api/deals')
      .send({ intent: mockIntent, finalDeal: mockValidFinalDeal })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(mockIntent.id);
    expect(res.body.data.intent.maxBudget).toBe(8000);
  });

  // 2. Invalid request payload
  it('2. Invalid request payload is rejected with 400 Bad Request', async () => {
    const res = await request(app)
      .post('/api/deals')
      .send({ intent: { maxBudget: -50 } }) // Missing required fields & negative budget
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('Invalid deal creation payload');
  });

  // 3. Client-forged VERIFIED status is ignored and verified independently on server
  it('3. Client-forged status is never trusted; server performs independent verification', async () => {
    // Attempt to store a deal with an invalid condition (refurbished) while claiming it is verified
    const forgedDeal: FinalDeal = {
      ...mockValidFinalDeal,
      condition: 'refurbished',
    };

    await request(app)
      .post('/api/deals')
      .send({ intent: mockIntent, finalDeal: forgedDeal })
      .expect(201);

    // Call server verify endpoint with client attempting to pass forged status
    const verifyRes = await request(app)
      .post(`/api/deals/${mockIntent.id}/verify`)
      .send({ finalDeal: forgedDeal })
      .expect(200);

    // Server must reject the refurbished deal regardless of what client wants
    expect(verifyRes.body.data.status).toBe('REJECTED');
    expect(verifyRes.body.data.rejectionReasons.some((r: string) => r.includes("'refurbished'"))).toBe(true);
  });

  // 4. Tampered total payable
  it('4. Tampered total payable is detected and rejected by server recalculation', async () => {
    const tamperedMathDeal: FinalDeal = {
      ...mockValidFinalDeal,
      productPrice: 6500,
      deliveryFee: 400,
      otherCharges: 200,
      totalPayable: 6500, // Deceptive! Actual sum is 7100
    };

    await request(app)
      .post('/api/deals')
      .send({ intent: mockIntent, finalDeal: tamperedMathDeal })
      .expect(201);

    const verifyRes = await request(app)
      .post(`/api/deals/${mockIntent.id}/verify`)
      .expect(200);

    expect(verifyRes.body.data.status).toBe('REJECTED');
    const budgetCheck = verifyRes.body.data.checks.find((c: any) => c.category === 'budget');
    expect(budgetCheck.status).toBe('failed');
    expect(budgetCheck.details).toContain('Internal calculation tampering detected');
  });

  // 5. Currency mismatch
  it('5. Currency mismatch is rejected on the server', async () => {
    const usdDeal: FinalDeal = {
      ...mockValidFinalDeal,
      currency: 'USD',
    };

    await request(app)
      .post('/api/deals')
      .send({ intent: mockIntent, finalDeal: usdDeal })
      .expect(201);

    const verifyRes = await request(app)
      .post(`/api/deals/${mockIntent.id}/verify`)
      .expect(200);

    expect(verifyRes.body.data.status).toBe('REJECTED');
    const currCheck = verifyRes.body.data.checks.find((c: any) => c.category === 'currency');
    expect(currCheck.status).toBe('failed');
  });

  // 6. Seller acceptance missing
  it('6. Seller acceptance missing (isAcceptedBySeller: false) fails verification', async () => {
    const unacceptedDeal: FinalDeal = {
      ...mockValidFinalDeal,
      isAcceptedBySeller: false,
    };

    await request(app)
      .post('/api/deals')
      .send({ intent: mockIntent, finalDeal: unacceptedDeal })
      .expect(201);

    const verifyRes = await request(app)
      .post(`/api/deals/${mockIntent.id}/verify`)
      .expect(200);

    expect(verifyRes.body.data.status).toBe('REJECTED');
    const statusCheck = verifyRes.body.data.checks.find((c: any) => c.category === 'transaction_status');
    expect(statusCheck.status).toBe('failed');
  });

  // 7. Budget ceiling breach
  it('7. Budget ceiling breach is rejected on server', async () => {
    const overBudgetDeal: FinalDeal = {
      ...mockValidFinalDeal,
      productPrice: 8500,
      totalPayable: 8500,
    };

    await request(app)
      .post('/api/deals')
      .send({ intent: mockIntent, finalDeal: overBudgetDeal })
      .expect(201);

    const verifyRes = await request(app)
      .post(`/api/deals/${mockIntent.id}/verify`)
      .expect(200);

    expect(verifyRes.body.data.status).toBe('REJECTED');
  });

  // 8. Delivery-window violation
  it('8. Delivery-window violation is rejected on server', async () => {
    const lateDeal: FinalDeal = {
      ...mockValidFinalDeal,
      deliveryEstimateDays: 5, // Ceiling is 3 days
    };

    await request(app)
      .post('/api/deals')
      .send({ intent: mockIntent, finalDeal: lateDeal })
      .expect(201);

    const verifyRes = await request(app)
      .post(`/api/deals/${mockIntent.id}/verify`)
      .expect(200);

    expect(verifyRes.body.data.status).toBe('REJECTED');
  });

  // 9. Subscription violation
  it('9. Subscription violation is rejected when user prohibited subscriptions', async () => {
    const subDeal: FinalDeal = {
      ...mockValidFinalDeal,
      hasSubscription: true,
      subscriptionDetails: 'Cloud Sync ₹299/mo',
    };

    await request(app)
      .post('/api/deals')
      .send({ intent: mockIntent, finalDeal: subDeal })
      .expect(201);

    const verifyRes = await request(app)
      .post(`/api/deals/${mockIntent.id}/verify`)
      .expect(200);

    expect(verifyRes.body.data.status).toBe('REJECTED');
  });

  // 10. Missing warranty evidence
  it('10. Missing warranty evidence flags NEEDS_REVIEW (never auto-passes)', async () => {
    const noWarrantyDeal: FinalDeal = {
      ...mockValidFinalDeal,
      warrantyMonths: null,
    };

    await request(app)
      .post('/api/deals')
      .send({ intent: mockIntent, finalDeal: noWarrantyDeal })
      .expect(201);

    const verifyRes = await request(app)
      .post(`/api/deals/${mockIntent.id}/verify`)
      .expect(200);

    expect(verifyRes.body.data.status).toBe('NEEDS_REVIEW');
  });

  // 11. Approval request for a rejected deal
  it('11. Approval request for a rejected deal is rejected with 400', async () => {
    const overBudgetDeal: FinalDeal = {
      ...mockValidFinalDeal,
      productPrice: 8500,
      totalPayable: 8500,
    };

    await request(app).post('/api/deals').send({ intent: mockIntent, finalDeal: overBudgetDeal });
    await request(app).post(`/api/deals/${mockIntent.id}/verify`);

    const approvalRes = await request(app)
      .post(`/api/deals/${mockIntent.id}/approval-request`)
      .expect(400);

    expect(approvalRes.body.error).toContain('Cannot request human approval for deal with verification status: REJECTED');
  });

  // 12. Successful explicit approval
  it('12. Successful explicit approval generates a single-use authorization token', async () => {
    await request(app).post('/api/deals').send({ intent: mockIntent, finalDeal: mockValidFinalDeal });
    await request(app).post(`/api/deals/${mockIntent.id}/verify`);
    await request(app).post(`/api/deals/${mockIntent.id}/approval-request`).expect(201);

    const approveRes = await request(app)
      .post(`/api/deals/${mockIntent.id}/approve`)
      .expect(200);

    expect(approveRes.body.success).toBe(true);
    expect(approveRes.body.data.status).toBe('APPROVED');
    expect(approveRes.body.data.authorizationToken).toBeDefined();
    expect(approveRes.body.data.authorizationToken.startsWith('AUTH-SRV-')).toBe(true);
  });

  // 13. Expired approval
  it('13. Expired approval cannot be approved or consumed', async () => {
    // Config with negative validity (immediate expiry)
    const expiredApp = createApp(db, { ...testConfig, APPROVAL_VALIDITY_SECONDS: -1 });

    await request(expiredApp).post('/api/deals').send({ intent: mockIntent, finalDeal: mockValidFinalDeal });
    await request(expiredApp).post(`/api/deals/${mockIntent.id}/verify`);
    await request(expiredApp).post(`/api/deals/${mockIntent.id}/approval-request`);

    const res = await request(expiredApp)
      .post(`/api/deals/${mockIntent.id}/approve`)
      .expect(400);

    expect(res.body.error).toContain('Approval request has expired');
  });

  // 14. Deal modification after verification
  it('14. Deal modification after verification blocks approval request', async () => {
    await request(app).post('/api/deals').send({ intent: mockIntent, finalDeal: mockValidFinalDeal });
    await request(app).post(`/api/deals/${mockIntent.id}/verify`);

    // Merchant secretly modifies price in database after report generation
    db.prepare(`UPDATE deals SET final_deal_json = ? WHERE id = ?`).run(
      JSON.stringify({ ...mockValidFinalDeal, productPrice: 7100, totalPayable: 7100 }),
      mockIntent.id
    );

    const res = await request(app)
      .post(`/api/deals/${mockIntent.id}/approval-request`)
      .expect(400);

    expect(res.body.error).toContain('Deal was modified after verification report was issued');
  });

  // 15. Payment completion bypass is disabled (Priority 2)
  it('15. Legacy consume-authorization endpoint is permanently disabled and rejects bypass attempts with 403', async () => {
    await request(app).post('/api/deals').send({ intent: mockIntent, finalDeal: mockValidFinalDeal });
    await request(app).post(`/api/deals/${mockIntent.id}/verify`);
    await request(app).post(`/api/deals/${mockIntent.id}/approval-request`);

    const approveRes = await request(app).post(`/api/deals/${mockIntent.id}/approve`);
    const token = approveRes.body.data.authorizationToken;

    const consumeRes = await request(app)
      .post(`/api/deals/${mockIntent.id}/consume-authorization`)
      .send({ authorizationToken: token })
      .expect(403);

    expect(consumeRes.body.error).toContain('Payment completion bypass is permanently disabled');

    // Confirm deal status remains unchanged (NOT payment_completed)
    const dealRes = await request(app).get(`/api/deals/${mockIntent.id}`).expect(200);
    expect(dealRes.body.data.status).not.toBe('payment_completed');
  });

  // 16. Invalid authorization token cannot bypass payment
  it('16. Any call to consume-authorization is blocked and cannot produce a completed payment', async () => {
    await request(app).post('/api/deals').send({ intent: mockIntent, finalDeal: mockValidFinalDeal });
    await request(app).post(`/api/deals/${mockIntent.id}/verify`);
    await request(app).post(`/api/deals/${mockIntent.id}/approval-request`);
    await request(app).post(`/api/deals/${mockIntent.id}/approve`);

    const res = await request(app)
      .post(`/api/deals/${mockIntent.id}/consume-authorization`)
      .send({ authorizationToken: 'INVALID-FAKE-TOKEN-123' })
      .expect(403);

    expect(res.body.error).toContain('Payment completion bypass is permanently disabled');
  });

  // 17. Authorization-only operation strictly prohibited from completing payment
  it('17. Authorization-only operation strictly prohibited from creating or completing payments', async () => {
    await request(app).post('/api/deals').send({ intent: mockIntent, finalDeal: mockValidFinalDeal });
    await request(app).post(`/api/deals/${mockIntent.id}/verify`);
    await request(app).post(`/api/deals/${mockIntent.id}/approval-request`);

    const approveRes = await request(app).post(`/api/deals/${mockIntent.id}/approve`);
    const token = approveRes.body.data.authorizationToken;

    await request(app)
      .post(`/api/deals/${mockIntent.id}/consume-authorization`)
      .send({ authorizationToken: token })
      .expect(403);

    // Verify database record has no completed payment
    const paymentCheck = db.prepare(`SELECT * FROM payments WHERE deal_id = ?`).all(mockIntent.id);
    expect(paymentCheck.length).toBe(0);

    const deal = db.prepare(`SELECT status FROM deals WHERE id = ?`).get(mockIntent.id) as any;
    expect(deal.status).not.toBe('payment_completed');
  });

  // 18. Double bypass attempts are also rejected with 403
  it('18. Repeated bypass attempts are consistently rejected', async () => {
    await request(app).post('/api/deals').send({ intent: mockIntent, finalDeal: mockValidFinalDeal });
    await request(app).post(`/api/deals/${mockIntent.id}/verify`);
    await request(app).post(`/api/deals/${mockIntent.id}/approval-request`);

    const approveRes = await request(app).post(`/api/deals/${mockIntent.id}/approve`);
    const token = approveRes.body.data.authorizationToken;

    await request(app)
      .post(`/api/deals/${mockIntent.id}/consume-authorization`)
      .send({ authorizationToken: token })
      .expect(403);

    await request(app)
      .post(`/api/deals/${mockIntent.id}/consume-authorization`)
      .send({ authorizationToken: token })
      .expect(403);
  });

  // 19. Concurrent attempts to bypass payment are all rejected with 403
  it('19. Concurrent attempts to bypass payment are all rejected with 403', async () => {
    await request(app).post('/api/deals').send({ intent: mockIntent, finalDeal: mockValidFinalDeal });
    await request(app).post(`/api/deals/${mockIntent.id}/verify`);
    await request(app).post(`/api/deals/${mockIntent.id}/approval-request`);

    const approveRes = await request(app).post(`/api/deals/${mockIntent.id}/approve`);
    const token = approveRes.body.data.authorizationToken;

    const [res1, res2] = await Promise.all([
      request(app).post(`/api/deals/${mockIntent.id}/consume-authorization`).send({ authorizationToken: token }),
      request(app).post(`/api/deals/${mockIntent.id}/consume-authorization`).send({ authorizationToken: token }),
    ]);

    expect(res1.status).toBe(403);
    expect(res2.status).toBe(403);
  });

  // 20. Persistence after server restart
  it('20. Records persist across simulated server restarts with SQLite file database', () => {
    // Setup file db
    const fs = require('node:fs');
    const path = require('node:path');
    const tempDbPath = path.join(process.cwd(), 'temp-test-persist.sqlite');

    try {
      if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);

      // Server Instance 1
      const db1 = initDatabase(tempDbPath);
      const app1 = createApp(db1, { ...testConfig, DATABASE_PATH: tempDbPath });

      // Create deal & audit event in Instance 1
      db1.prepare(`
        INSERT INTO deals (id, user_id, title, status, intent_json, final_deal_json, created_at, updated_at)
        VALUES ('persist-1', 'user-1', 'Persistent Deal', 'draft', ?, NULL, '2026-10-30', '2026-10-30')
      `).run(JSON.stringify(mockIntent));

      db1.close();

      // Server Instance 2 (Simulating reboot)
      const db2 = initDatabase(tempDbPath);
      const dealRow = db2.prepare('SELECT * FROM deals WHERE id = ?').get('persist-1') as any;

      expect(dealRow).toBeDefined();
      expect(dealRow.id).toBe('persist-1');
      expect(dealRow.title).toBe('Persistent Deal');

      db2.close();
    } finally {
      if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
    }
  });

  // 21. Unauthorized access to another user's deal
  it("21. Unauthorized access to another user's deal is blocked with 403 Forbidden", async () => {
    // Create deal as user-alice with valid signed session
    await request(app)
      .post('/api/deals')
      .set(authHeader('user-alice'))
      .send({ intent: mockIntent, finalDeal: mockValidFinalDeal })
      .expect(201);

    // Attempt to verify as user-bob with Bob's valid signed session
    const res = await request(app)
      .post(`/api/deals/${mockIntent.id}/verify`)
      .set(authHeader('user-bob'))
      .expect(403);

    expect(res.body.error).toContain('Unauthorized access to this deal');
  });

  // 22. Invalid state transition
  it('22. Invalid state transition (e.g. attempting to decline an already approved deal) is blocked', async () => {
    await request(app).post('/api/deals').send({ intent: mockIntent, finalDeal: mockValidFinalDeal });
    await request(app).post(`/api/deals/${mockIntent.id}/verify`);
    await request(app).post(`/api/deals/${mockIntent.id}/approval-request`);
    await request(app).post(`/api/deals/${mockIntent.id}/approve`).expect(200);

    // Attempting to decline after deal was already APPROVED
    const declineRes = await request(app)
      .post(`/api/deals/${mockIntent.id}/decline`)
      .expect(400);

    expect(declineRes.body.error).toContain('No pending approval request to decline');
  });

  // 23. Audit event persistence
  it('23. Audit events persist on server and are retrievable via GET /api/deals/:id/audit', async () => {
    await request(app).post('/api/deals').send({ intent: mockIntent, finalDeal: mockValidFinalDeal });
    await request(app).post(`/api/deals/${mockIntent.id}/verify`);

    const auditRes = await request(app)
      .get(`/api/deals/${mockIntent.id}/audit`)
      .expect(200);

    expect(auditRes.body.success).toBe(true);
    expect(Array.isArray(auditRes.body.data)).toBe(true);
    expect(auditRes.body.data.length).toBeGreaterThanOrEqual(2);
    expect(auditRes.body.data.some((e: any) => e.type === 'verification_started')).toBe(true);
  });

  // 24. Backend error handling
  it('24. Backend error handler returns structured JSON error responses', async () => {
    const res = await request(app)
      .get('/api/deals/non-existent-deal-id-999')
      .expect(404);

    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Deal not found');
  });
});
