// The JSON Web Tokens the stores ask for: HS256 for addons.mozilla.org (its API key's issuer and secret), RS256 for
// Google (a service account's private key, exchanged for an access token).
import { createHmac, createSign } from 'node:crypto'

const part = (value: object | string) =>
  Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url')

/** A token signed with a shared secret (HMAC SHA-256). */
export function hs256(claims: object, secret: string): string {
  const unsigned = `${part({ alg: 'HS256', typ: 'JWT' })}.${part(claims)}`
  return `${unsigned}.${createHmac('sha256', secret).update(unsigned).digest('base64url')}`
}

/** A token signed with an RSA private key, in PEM (RSASSA-PKCS1-v1_5, SHA-256). */
export function rs256(claims: object, privateKey: string): string {
  const unsigned = `${part({ alg: 'RS256', typ: 'JWT' })}.${part(claims)}`
  return `${unsigned}.${createSign('RSA-SHA256').update(unsigned).sign(privateKey, 'base64url')}`
}
