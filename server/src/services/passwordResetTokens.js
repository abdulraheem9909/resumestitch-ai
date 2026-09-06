import crypto from 'node:crypto';

const RESET_TOKEN_BYTES = 32;

// The raw token already has full entropy (32 random bytes) — bcrypt's
// deliberate slowness buys nothing here and only costs CPU, so the stored
// lookup value is a plain SHA-256 hash instead.
export function generateResetToken() {
  const token = crypto.randomBytes(RESET_TOKEN_BYTES).toString('hex');
  const tokenHash = hashResetToken(token);
  const expiresMs = Number(process.env.RESET_TOKEN_EXPIRES_MS) || 3600000;
  const expiresAt = new Date(Date.now() + expiresMs);
  return { token, tokenHash, expiresAt };
}

export function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}
