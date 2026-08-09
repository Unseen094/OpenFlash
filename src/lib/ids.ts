/**
 * Cryptographically secure ID generation.
 *
 * `Math.random()` is not a CSPRNG — its output is predictable from prior
 * samples, which makes IDs derived from it guessable. Anything identifying a
 * payment, payout, or published asset must not be guessable, so all such IDs
 * come from the Web Crypto API.
 *
 * `crypto.randomUUID()` is only exposed in secure contexts; the fallback uses
 * `crypto.getRandomValues()`, which is available more widely and is equally
 * secure.
 */
export function secureId(prefix: string): string {
  return `${prefix}_${randomToken()}`
}

function randomToken(): string {
  const c = globalThis.crypto
  if (typeof c?.randomUUID === 'function') {
    return c.randomUUID()
  }
  if (typeof c?.getRandomValues === 'function') {
    const bytes = new Uint8Array(16)
    c.getRandomValues(bytes)
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
  }
  throw new Error('Secure random source unavailable: Web Crypto API is required for ID generation.')
}
