/**
 * Token Generator Utility
 *
 * Generates cryptographically secure access tokens for campaign reports.
 */

import { randomBytes } from 'crypto';

/**
 * Generates a cryptographically secure access token.
 */
export function generateAccessToken(): string {
  const buffer = randomBytes(32);

  const token = buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return token;
}

/**
 * Validates that a token matches the expected format.
 */
export function isValidTokenFormat(token: string): boolean {
  const base64urlPattern = /^[A-Za-z0-9_-]{43}$/;
  return base64urlPattern.test(token);
}

/**
 * Generates multiple unique tokens for testing or batch operations.
 */
export function generateMultipleTokens(count: number): string[] {
  const tokens: string[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < count; i++) {
    let token: string;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      token = generateAccessToken();
      attempts++;

      if (attempts > maxAttempts) {
        throw new Error(
          `Failed to generate unique token after ${maxAttempts} attempts. ` +
          `This should never happen with 256-bit entropy.`
        );
      }
    } while (seen.has(token));

    seen.add(token);
    tokens.push(token);
  }

  return tokens;
}
