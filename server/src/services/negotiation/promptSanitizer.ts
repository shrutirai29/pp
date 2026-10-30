/**
 * Sanitizes untrusted user strings, product descriptions, and seller notes
 * before embedding into LLM system or user prompts.
 * Prevents prompt injections from hijacking model reasoning.
 */
export function sanitizeForPrompt(input: string, maxLength: number = 300): string {
  if (!input || typeof input !== 'string') return '';

  let sanitized = input
    // Remove control characters and non-printable characters
    .replace(/[\x00-\x1F\x7F-\x9F]/g, ' ')
    // Strip common prompt injection command patterns
    .replace(/(?:system\s*prompt|system\s*instruction|ignore\s*(?:all\s*)?previous|override\s*(?:system|intent|budget)|you\s*are\s*now|pretend\s*to\s*be)/gi, '[FILTERED]')
    // Normalize excessive whitespace
    .replace(/\s+/g, ' ')
    .trim();

  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength) + '...';
  }

  return sanitized;
}
