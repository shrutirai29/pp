import crypto from 'node:crypto';

export interface SessionTokenPayload {
  userId: string;
  exp: number; // Unix timestamp in seconds
  iat: number; // Unix timestamp in seconds
  scope?: string;
}

export interface VerifySessionResult {
  valid: boolean;
  userId?: string;
  payload?: SessionTokenPayload;
  reason?: string;
}

/**
 * Creates an HMAC-SHA256 signed session token.
 * Format: `<base64url_payload>.<base64url_signature>`
 */
export function createSessionToken(
  userId: string,
  secret: string,
  expiresInSeconds: number = 86400,
  scope?: string
): string {
  if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
    throw new Error('Cannot create session token: userId must be a non-empty string.');
  }
  if (!secret || typeof secret !== 'string' || secret.length === 0) {
    throw new Error('Cannot create session token: secret must not be empty.');
  }

  const now = Math.floor(Date.now() / 1000);
  const payload: SessionTokenPayload = {
    userId: userId.trim(),
    iat: now,
    exp: now + expiresInSeconds,
    scope: scope || 'user',
  };

  const serializedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(serializedPayload)
    .digest('base64url');

  return `${serializedPayload}.${signature}`;
}

/**
 * Cryptographically verifies an HMAC-SHA256 signed session token.
 * Validates format, signature using constant-time comparison, and expiration.
 */
export function verifySessionToken(token: string, secret: string): VerifySessionResult {
  if (!token || typeof token !== 'string') {
    return { valid: false, reason: 'Missing or malformed token.' };
  }

  const parts = token.trim().split('.');
  if (parts.length !== 2) {
    return { valid: false, reason: 'Invalid token structure. Expected signed session token format.' };
  }

  const [serializedPayload, suppliedSignature] = parts;

  // Recompute HMAC signature
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(serializedPayload)
    .digest('base64url');

  const suppliedBuf = Buffer.from(suppliedSignature, 'utf8');
  const expectedBuf = Buffer.from(expectedSignature, 'utf8');

  if (suppliedBuf.length !== expectedBuf.length) {
    return { valid: false, reason: 'Invalid token signature.' };
  }

  if (!crypto.timingSafeEqual(suppliedBuf, expectedBuf)) {
    return { valid: false, reason: 'Invalid token signature.' };
  }

  // Parse and validate payload
  try {
    const rawJson = Buffer.from(serializedPayload, 'base64url').toString('utf8');
    const payload = JSON.parse(rawJson) as SessionTokenPayload;

    if (!payload.userId || typeof payload.userId !== 'string') {
      return { valid: false, reason: 'Token payload missing valid userId.' };
    }

    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp === 'number' && now > payload.exp) {
      return { valid: false, reason: 'Session token has expired.' };
    }

    return {
      valid: true,
      userId: payload.userId,
      payload,
    };
  } catch {
    return { valid: false, reason: 'Malformed token payload.' };
  }
}
