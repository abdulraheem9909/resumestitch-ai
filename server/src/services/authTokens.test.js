import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'test-secret-for-authTokens-spec';

const { hashPassword, comparePassword, signToken, verifyToken } = await import('./authTokens.js');

test('hashPassword/comparePassword round trip', async () => {
  const hash = await hashPassword('correct horse battery staple');
  assert.notEqual(hash, 'correct horse battery staple');
  assert.equal(await comparePassword('correct horse battery staple', hash), true);
  assert.equal(await comparePassword('wrong password', hash), false);
});

test('signToken/verifyToken round trip carries the userId as sub', () => {
  const token = signToken('507f1f77bcf86cd799439011');
  const payload = verifyToken(token);
  assert.equal(payload.sub, '507f1f77bcf86cd799439011');
});

test('verifyToken rejects an expired token', () => {
  const hadExpiresIn = 'JWT_EXPIRES_IN' in process.env;
  const previousExpiresIn = process.env.JWT_EXPIRES_IN;
  process.env.JWT_EXPIRES_IN = '-1s';
  const expiredToken = signToken('507f1f77bcf86cd799439011');
  if (hadExpiresIn) {
    process.env.JWT_EXPIRES_IN = previousExpiresIn;
  } else {
    delete process.env.JWT_EXPIRES_IN;
  }
  assert.throws(() => verifyToken(expiredToken), /jwt expired/);
});

test('verifyToken rejects a tampered signature', () => {
  const token = signToken('507f1f77bcf86cd799439011');
  const tampered = `${token.slice(0, -1)}${token.endsWith('a') ? 'b' : 'a'}`;
  assert.throws(() => verifyToken(tampered), /invalid signature/);
});
