import { DatabaseSync } from '../db/sqliteAdapter.js';
import { ServerVerificationReport } from '../services/intentLockService.js';

export interface StoredVerificationReport {
  id: string;
  dealId: string;
  fingerprint: string;
  status: string;
  summary: string;
  report: ServerVerificationReport;
  createdAt: string;
}

export class VerificationRepository {
  constructor(private db: DatabaseSync) {}

  public saveReport(report: ServerVerificationReport): StoredVerificationReport {
    const stmt = this.db.prepare(`
      INSERT INTO verification_reports (id, deal_id, fingerprint, status, summary, report_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      report.id,
      report.dealId,
      report.dealFingerprint,
      report.status,
      report.summary,
      JSON.stringify(report),
      report.verifiedAt
    );

    return {
      id: report.id,
      dealId: report.dealId,
      fingerprint: report.dealFingerprint,
      status: report.status,
      summary: report.summary,
      report,
      createdAt: report.verifiedAt,
    };
  }

  public getLatestReportForDeal(dealId: string): StoredVerificationReport | null {
    const stmt = this.db.prepare(`
      SELECT * FROM verification_reports
      WHERE deal_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `);
    const row = stmt.get(dealId) as Record<string, unknown> | undefined;

    if (!row) return null;

    return {
      id: String(row.id),
      dealId: String(row.deal_id),
      fingerprint: String(row.fingerprint),
      status: String(row.status),
      summary: String(row.summary),
      report: JSON.parse(String(row.report_json)),
      createdAt: String(row.created_at),
    };
  }

  public getReport(reportId: string): StoredVerificationReport | null {
    const stmt = this.db.prepare(`SELECT * FROM verification_reports WHERE id = ?`);
    const row = stmt.get(reportId) as Record<string, unknown> | undefined;

    if (!row) return null;

    return {
      id: String(row.id),
      dealId: String(row.deal_id),
      fingerprint: String(row.fingerprint),
      status: String(row.status),
      summary: String(row.summary),
      report: JSON.parse(String(row.report_json)),
      createdAt: String(row.created_at),
    };
  }
}
