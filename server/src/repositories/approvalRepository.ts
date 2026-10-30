import { DatabaseSync } from '../db/sqliteAdapter.js';

export interface StoredApproval {
  id: string;
  dealId: string;
  reportId: string;
  userId: string;
  fingerprint: string;
  status: 'PENDING' | 'APPROVED' | 'DECLINED' | 'CONSUMED' | 'EXPIRED' | 'INVALIDATED';
  tokenHash: string | null;
  createdAt: string;
  expiresAt: string;
  approvedAt: string | null;
  declinedAt: string | null;
  consumedAt: string | null;
  invalidationReason: string | null;
}

export class ApprovalRepository {
  constructor(private db: DatabaseSync) {}

  public createApprovalRequest(
    approvalId: string,
    dealId: string,
    reportId: string,
    userId: string,
    fingerprint: string,
    expiresAt: string
  ): StoredApproval {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO approvals (
        id, deal_id, report_id, user_id, fingerprint, status, token_hash,
        created_at, expires_at, approved_at, declined_at, consumed_at, invalidation_reason
      )
      VALUES (?, ?, ?, ?, ?, 'PENDING', NULL, ?, ?, NULL, NULL, NULL, NULL)
    `);

    stmt.run(approvalId, dealId, reportId, userId, fingerprint, now, expiresAt);

    return {
      id: approvalId,
      dealId,
      reportId,
      userId,
      fingerprint,
      status: 'PENDING',
      tokenHash: null,
      createdAt: now,
      expiresAt,
      approvedAt: null,
      declinedAt: null,
      consumedAt: null,
      invalidationReason: null,
    };
  }

  public getApproval(approvalId: string): StoredApproval | null {
    const stmt = this.db.prepare(`SELECT * FROM approvals WHERE id = ?`);
    const row = stmt.get(approvalId) as Record<string, unknown> | undefined;
    return row ? this.mapRow(row) : null;
  }

  public getApprovalById(approvalId: string): StoredApproval | null {
    return this.getApproval(approvalId);
  }

  public getLatestApprovalForDeal(dealId: string): StoredApproval | null {
    const stmt = this.db.prepare(`
      SELECT * FROM approvals
      WHERE deal_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `);
    const row = stmt.get(dealId) as Record<string, unknown> | undefined;
    return row ? this.mapRow(row) : null;
  }

  public updateToApproved(approvalId: string, tokenHash: string): boolean {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE approvals
      SET status = 'APPROVED', token_hash = ?, approved_at = ?
      WHERE id = ? AND status = 'PENDING'
    `);
    const info = stmt.run(tokenHash, now, approvalId);
    return Number(info.changes) > 0;
  }

  public updateToDeclined(approvalId: string): boolean {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE approvals
      SET status = 'DECLINED', declined_at = ?
      WHERE id = ? AND status = 'PENDING'
    `);
    const info = stmt.run(now, approvalId);
    return Number(info.changes) > 0;
  }

  public updateToInvalidated(approvalId: string, reason: string): boolean {
    const stmt = this.db.prepare(`
      UPDATE approvals
      SET status = 'INVALIDATED', invalidation_reason = ?
      WHERE id = ?
    `);
    const info = stmt.run(reason, approvalId);
    return Number(info.changes) > 0;
  }

  public updateToExpired(approvalId: string): boolean {
    const stmt = this.db.prepare(`
      UPDATE approvals
      SET status = 'EXPIRED'
      WHERE id = ? AND status IN ('PENDING', 'APPROVED')
    `);
    const info = stmt.run(approvalId);
    return Number(info.changes) > 0;
  }

  /**
   * Atomic consumption of authorization token.
   * Uses conditional WHERE status = 'APPROVED' to guarantee that concurrent requests
   * cannot consume the same authorization more than once.
   */
  public atomicConsumeApproval(approvalId: string): boolean {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE approvals
      SET status = 'CONSUMED', consumed_at = ?
      WHERE id = ? AND status = 'APPROVED'
    `);
    const info = stmt.run(now, approvalId);
    return Number(info.changes) > 0;
  }

  private mapRow(row: Record<string, unknown>): StoredApproval {
    return {
      id: String(row.id),
      dealId: String(row.deal_id),
      reportId: String(row.report_id),
      userId: String(row.user_id),
      fingerprint: String(row.fingerprint),
      status: row.status as StoredApproval['status'],
      tokenHash: row.token_hash ? String(row.token_hash) : null,
      createdAt: String(row.created_at),
      expiresAt: String(row.expires_at),
      approvedAt: row.approved_at ? String(row.approved_at) : null,
      declinedAt: row.declined_at ? String(row.declined_at) : null,
      consumedAt: row.consumed_at ? String(row.consumed_at) : null,
      invalidationReason: row.invalidation_reason ? String(row.invalidation_reason) : null,
    };
  }
}
