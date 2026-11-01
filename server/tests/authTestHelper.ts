import { createSessionToken } from '../src/services/authService.js';

export const TEST_SECRET = 'test_secret_key_123';

export function createTestToken(
  userId: string,
  secret: string = TEST_SECRET,
  expiresInSeconds: number = 86400
): string {
  return createSessionToken(userId, secret, expiresInSeconds);
}

export function authHeader(userId: string, secret: string = TEST_SECRET): { Authorization: string } {
  return {
    Authorization: `Bearer ${createTestToken(userId, secret)}`,
  };
}
