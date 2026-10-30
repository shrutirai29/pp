import { FinalDeal } from '../../types/negotiation';
import { CanonicalDealData } from './verificationTypes';

/**
 * Extracts strictly security-relevant fields from a FinalDeal and formats them
 * into a canonical, deterministic object. Volatile UI fields, timestamps,
 * and conversational transcripts are deliberately excluded.
 */
export function extractCanonicalDealData(deal: FinalDeal): CanonicalDealData {
  return {
    dealId: String(deal.dealId).trim(),
    originalOfferId: String(deal.originalOfferId).trim(),
    sellerId: String(deal.sellerId).trim(),
    productTitle: String(deal.productTitle).trim(),
    condition: deal.condition,
    productPrice: Number(deal.productPrice),
    deliveryFee: Number(deal.deliveryFee || 0),
    otherCharges: Number(deal.otherCharges || 0),
    totalPayable: Number(deal.productPrice) + Number(deal.deliveryFee || 0) + Number(deal.otherCharges || 0),
    deliveryEstimateDays: Number(deal.deliveryEstimateDays),
    warrantyMonths: deal.warrantyMonths !== null && deal.warrantyMonths !== undefined ? Number(deal.warrantyMonths) : null,
    hasSubscription: Boolean(deal.hasSubscription),
    subscriptionDetails: deal.subscriptionDetails ? String(deal.subscriptionDetails).trim() : '',
    currency: deal.currency,
    isAcceptedBySeller: Boolean(deal.isAcceptedBySeller),
    negotiationStatus: String(deal.negotiationStatus).trim(),
    stopReason: deal.stopReason,
  };
}

/**
 * Produces a deterministic canonical JSON string by sorting all keys alphabetically.
 */
export function serializeCanonicalDealData(data: CanonicalDealData): string {
  const sortedKeys = Object.keys(data).sort() as (keyof CanonicalDealData)[];
  const sortedObj: Record<string, unknown> = {};
  for (const key of sortedKeys) {
    sortedObj[key] = data[key];
  }
  return JSON.stringify(sortedObj);
}

/**
 * Fallback pure-JS SHA-256 implementation so fingerprinting is guaranteed to work
 * synchronously in any browser, server, or testing environment without async delays.
 */
function sha256Sync(ascii: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let lengthProperty = 'length';
  let i = 0, j = 0;
  let result = '';

  const words: number[] = [];
  const asciiBitLength = ascii[lengthProperty as 'length'] * 8;

  const hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;

  const isComposite: Record<number, boolean> = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 313; i += candidate) {
        isComposite[i] = true;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  ascii += '\x80';
  while ((ascii[lengthProperty as 'length'] % 64) - 56) ascii += '\x00';
  for (i = 0; i < ascii[lengthProperty as 'length']; i++) {
    j = ascii.charCodeAt(i);
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words[lengthProperty as 'length']] = (asciiBitLength / maxWord) | 0;
  words[words[lengthProperty as 'length']] = asciiBitLength;

  for (j = 0; j < words[lengthProperty as 'length'];) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0);

    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15], w2 = w[i - 2];

      const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
      const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
      w[i] = i < 16 ? w[i] : (w[i - 16] + s0 + w[i - 7] + s1) | 0;

      const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      const temp1 = (hash[7] + (rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25)) + ch + k[i] + w[i]) | 0;
      const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      const temp2 = ((rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22)) + maj) | 0;

      hash[7] = hash[6];
      hash[6] = hash[5];
      hash[5] = hash[4];
      hash[4] = (hash[3] + temp1) | 0;
      hash[3] = hash[2];
      hash[2] = hash[1];
      hash[1] = hash[0];
      hash[0] = (temp1 + temp2) | 0;
    }

    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

/**
 * Generates an authoritative SHA-256 fingerprint for a FinalDeal.
 * 
 * ARCHITECTURAL NOTICE:
 * Genuine tamper-resistant verification requires a trusted server-side execution environment
 * holding authoritative cryptographic keys. Browser-generated fingerprints serve as a demonstration
 * model for detecting post-verification client modifications and verifying consistency.
 */
export function generateDealFingerprint(deal: FinalDeal): string {
  const canonicalData = extractCanonicalDealData(deal);
  const serialized = serializeCanonicalDealData(canonicalData);
  return sha256Sync(serialized);
}

/**
 * Asynchronous Web Crypto API version of fingerprint generator if required.
 */
export async function generateDealFingerprintAsync(deal: FinalDeal): Promise<string> {
  if (typeof globalThis.crypto?.subtle?.digest === 'function') {
    const canonicalData = extractCanonicalDealData(deal);
    const serialized = serializeCanonicalDealData(canonicalData);
    const msgBuffer = new TextEncoder().encode(serialized);
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  return generateDealFingerprint(deal);
}

/**
 * Compares two deals or a deal against an authoritative fingerprint to detect tampering.
 */
export function verifyDealIntegrity(deal: FinalDeal, expectedFingerprint: string): {
  isUntampered: boolean;
  actualFingerprint: string;
  expectedFingerprint: string;
} {
  const actualFingerprint = generateDealFingerprint(deal);
  return {
    isUntampered: actualFingerprint === expectedFingerprint,
    actualFingerprint,
    expectedFingerprint,
  };
}
