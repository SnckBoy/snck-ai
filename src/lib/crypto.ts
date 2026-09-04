import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('ENCRYPTION_KEY environment variable is missing');
  }
  // Accept either a 64-char hex string (32 bytes) or a raw 32-byte string.
  let key: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    key = Buffer.from(raw, 'hex');
  } else {
    key = Buffer.from(raw, 'utf8');
  }
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must resolve to exactly 32 bytes');
  }
  return key;
}

const ENCRYPTED_PREFIX = 'enc:v1:';

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return (
    ENCRYPTED_PREFIX + [iv, tag, encrypted].map((b) => b.toString('base64')).join('.')
  );
}

export function decryptSecret(payload: string): string {
  if (!payload.startsWith(ENCRYPTED_PREFIX)) {
    throw new Error('Payload is not an encrypted secret');
  }
  const [ivB64, tagB64, dataB64] = payload.slice(ENCRYPTED_PREFIX.length).split('.');
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('Malformed encrypted payload');
  }
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

export function maskSecret(secret: string): string {
  if (secret.length <= 8) return '••••••••';
  const prefix = secret.slice(0, 3);
  const suffix = secret.slice(-4);
  return `${prefix}••••••••${suffix}`;
}
