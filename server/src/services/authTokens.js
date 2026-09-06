import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const SALT_ROUNDS = 10;

export async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function signToken(userId) {
  const secret = process.env.JWT_SECRET;
  const expiresIn = process.env.JWT_EXPIRES_IN || '30d';
  return jwt.sign({ sub: String(userId) }, secret, { expiresIn });
}

export function verifyToken(token) {
  const secret = process.env.JWT_SECRET;
  return jwt.verify(token, secret);
}
