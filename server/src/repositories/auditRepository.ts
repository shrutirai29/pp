import { DatabaseSync } from '../db/sqliteAdapter.js';

export interface StoredAuditEvent {
  id: string;
  dealId: string;
  timestamp: string;
  type: string;
  title: string;
  description: string;
  actor: string;
  metadata?: Record<string, unknown>;
}

export class AuditRepository {
  constructor(private db: DatabaseSync) {}

  public recordEvent(
    dealId: string,
    type: string,
    title: string,
    description: string,
    actor: string,
    metadata?: Record<string, unknown>
  ): StoredAuditEvent {
    const id = `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO audit_events (id, deal_id, timestamp, type, title, description, actor, metadata_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      dealId,
      now,
      type,
      title,
      description,
      actor,
      metadata ? JSON.stringify(metadata) : null
    );

    return {
      id,
      dealId,
      timestamp: now,
      type,
      title,
      description,
      actor,
      metadata,
    };
  }

  public getEventsForDeal(dealId: string): StoredAuditEvent[] {
    const stmt = this.db.prepare(`
      SELECT * FROM audit_events
      WHERE deal_id = ?
      ORDER BY timestamp DESC
    `);
    const rows = stmt.all(dealId) as Record<string, unknown>[];

    return rows.map((r) => ({
      id: String(r.id),
      dealId: String(r.deal_id),
      timestamp: String(r.timestamp),
      type: String(r.type),
      title: String(r.title),
      description: String(r.description),
      actor: String(r.actor),
      metadata: r.metadata_json ? JSON.parse(String(r.metadata_json)) : undefined,
    }));
  }
}
