import { DatabaseSync } from './sqliteAdapter.js';
import fs from 'node:fs';
import path from 'node:path';

export function initDatabase(dbPath: string): DatabaseSync {
  if (dbPath !== ':memory:') {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new DatabaseSync(dbPath);

  // Enable WAL mode & foreign keys for SQLite reliability
  if (dbPath !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL;');
  }
  db.exec('PRAGMA foreign_keys = ON;');

  // Run schema creation
  db.exec(`
    CREATE TABLE IF NOT EXISTS deals (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      intent_json TEXT NOT NULL,
      final_deal_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS verification_reports (
      id TEXT PRIMARY KEY,
      deal_id TEXT NOT NULL,
      fingerprint TEXT NOT NULL,
      status TEXT NOT NULL,
      summary TEXT NOT NULL,
      report_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS approvals (
      id TEXT PRIMARY KEY,
      deal_id TEXT NOT NULL,
      report_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      fingerprint TEXT NOT NULL,
      status TEXT NOT NULL,
      token_hash TEXT,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      approved_at TEXT,
      declined_at TEXT,
      consumed_at TEXT,
      invalidation_reason TEXT,
      FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE,
      FOREIGN KEY (report_id) REFERENCES verification_reports(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY,
      deal_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      actor TEXT NOT NULL,
      metadata_json TEXT,
      FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      deal_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      approval_id TEXT NOT NULL,
      paypal_order_id TEXT NOT NULL UNIQUE,
      paypal_capture_id TEXT,
      status TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      idempotency_key TEXT,
      payer_email TEXT,
      payer_id TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE,
      FOREIGN KEY (approval_id) REFERENCES approvals(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_audit_deal_id ON audit_events(deal_id);
    CREATE INDEX IF NOT EXISTS idx_approvals_deal_id ON approvals(deal_id);
    CREATE INDEX IF NOT EXISTS idx_verification_deal_id ON verification_reports(deal_id);
    CREATE INDEX IF NOT EXISTS idx_payments_deal_id ON payments(deal_id);
    CREATE INDEX IF NOT EXISTS idx_payments_paypal_order_id ON payments(paypal_order_id);
    CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
    CREATE INDEX IF NOT EXISTS idx_deals_user_id ON deals(user_id);
  `);

  return db;
}
