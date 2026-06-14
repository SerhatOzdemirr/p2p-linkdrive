// core/crypto.js — AES-GCM 256-bit Zero-Knowledge şifreleme

const IV_LENGTH = 12; // 96-bit nonce (NIST SP 800-38D)

/**
 * URL fragment'taki hex secret'tan AES-GCM key üret.
 * extractable: false → key asla Web Crypto dışına çıkamaz.
 */
export async function deriveKey(hexSecret) {
  const raw = Uint8Array.from(
    hexSecret.match(/.{2}/g).map((b) => parseInt(b, 16))
  )
  return crypto.subtle.importKey(
    'raw',
    raw.buffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  )
}

/**
 * Wire format: [12 byte IV][ciphertext + 16 byte auth-tag]
 * Her çağrıda farklı IV — nonce tekrarı yok.
 */
export async function encrypt(key, plaintext /* ArrayBuffer */) {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    key,
    plaintext
  )
  const out = new Uint8Array(IV_LENGTH + ct.byteLength)
  out.set(iv, 0)
  out.set(new Uint8Array(ct), IV_LENGTH)
  return out.buffer
}

/**
 * Auth-tag yanlışsa decrypt throw eder → DECRYPTION_ERROR
 */
export async function decrypt(key, data /* ArrayBuffer */) {
  const buf = new Uint8Array(data)
  const iv  = buf.slice(0, IV_LENGTH)
  const ct  = buf.slice(IV_LENGTH)
  return crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    key,
    ct
  )
}

/** 32-byte random hex → oda ID veya AES key üretimi */
export function generateHex(byteLength = 16) {
  const arr = crypto.getRandomValues(new Uint8Array(byteLength))
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** ArrayBuffer → base64 string (DataChannel JSON taşıma için) */
export function bufToBase64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
}

/** base64 string → ArrayBuffer */
export function base64ToBuf(b64) {
  const bin = atob(b64)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return arr.buffer
}
