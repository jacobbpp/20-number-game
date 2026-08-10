// Web Push, VAPID only, with no encrypted payload.
//
// A push message may carry a body, but the body has to be encrypted
// separately for every subscription (RFC 8291: an ECDH exchange against that
// browser's own key, then HKDF, then AES-GCM). Nothing here needs one. The
// phone already has the app, so it can fetch the recap itself and write the
// notification text at the moment it is shown — which skips the entire
// encryption path and has the pleasant side effect that the text is current
// rather than whatever was true when the send started.
//
// So this module does one thing: prove to the push service that the message
// came from this app, by signing a short-lived token with the VAPID key.

// Twelve hours. The spec caps this at 24 and push services reject anything
// beyond it, so this leaves room for a clock that is a few hours out.
const JWT_TTL_SECONDS = 12 * 60 * 60

// How long the push service should hold the message for a phone that is off.
// Six hours: a reminder that today's challenge has landed is not news by the
// evening, and a stale one arriving at bedtime is worse than none.
const PUSH_TTL_SECONDS = 6 * 60 * 60

// The "sub" claim: how a push service would get in touch about traffic from
// this application server. A https: URI is as valid as a mailto: here, and
// this repository is public.
const CONTACT = 'https://jacobbpp.github.io/20-number-game/'

export interface VapidKeys {
  // Uncompressed P-256 point, base64url, 65 bytes. The same value the browser
  // passes as applicationServerKey when it subscribes.
  publicKey: string
  // The matching private scalar, base64url, 32 bytes. Held as a Worker secret.
  privateKey: string
}

function base64url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let binary = ''
  for (const byte of view) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64urlText(text: string): string {
  return base64url(new TextEncoder().encode(text))
}

function fromBase64url(value: string): Uint8Array {
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(binary, character => character.charCodeAt(0))
}

// WebCrypto will not import a bare private scalar, so the key is rebuilt as a
// JWK. The public half supplies x and y, which is why both keys are needed to
// sign rather than just the private one.
async function signingKey(keys: VapidKeys): Promise<CryptoKey> {
  const point = fromBase64url(keys.publicKey)
  if (point.length !== 65 || point[0] !== 0x04) {
    throw new Error('VAPID public key is not an uncompressed P-256 point')
  }

  return crypto.subtle.importKey(
    'jwk',
    {
      kty: 'EC',
      crv: 'P-256',
      x: base64url(point.slice(1, 33)),
      y: base64url(point.slice(33, 65)),
      d: keys.privateKey,
      ext: false,
    },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )
}

// The token is bound to one push service by its "aud" claim, so a token
// captured in transit cannot be replayed against a different one.
export async function vapidAuthorization(endpoint: string, keys: VapidKeys, nowMs: number): Promise<string> {
  const header = base64urlText(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))
  const claims = base64urlText(
    JSON.stringify({
      aud: new URL(endpoint).origin,
      exp: Math.floor(nowMs / 1000) + JWT_TTL_SECONDS,
      sub: CONTACT,
    }),
  )

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    await signingKey(keys),
    new TextEncoder().encode(`${header}.${claims}`),
  )

  // ECDSA signatures come out of WebCrypto as raw r||s, which is exactly the
  // form JWS wants for ES256. No DER unwrapping needed.
  return `vapid t=${header}.${claims}.${base64url(signature)}, k=${keys.publicKey}`
}

// 404 and 410 are the push service saying this subscription is gone for good:
// the browser was uninstalled, the site data cleared, or the user revoked
// permission. Anything else is a transient problem and the row stays.
export function isSubscriptionGone(status: number): boolean {
  return status === 404 || status === 410
}

// Resolves to the push service's status code. It never throws for a refused
// send: one unreachable endpoint must not stop the rest of the run.
export async function sendPush(endpoint: string, keys: VapidKeys, nowMs: number): Promise<number> {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: await vapidAuthorization(endpoint, keys, nowMs),
        TTL: String(PUSH_TTL_SECONDS),
      },
    })
    return response.status
  } catch {
    // A network failure is not a dead subscription, so report something that
    // isSubscriptionGone will not act on.
    return 0
  }
}
