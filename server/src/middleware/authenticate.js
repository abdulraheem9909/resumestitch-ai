import { verifyToken } from '../services/authTokens.js';

// Stateless — no per-request DB lookup. Tradeoff: a deleted user's token
// stays "valid" until it expires. Acceptable since no user-deletion feature
// exists in this app.
export function authenticate(req, res, next) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Missing or invalid authorization header.' });
  }
  try {
    const payload = verifyToken(token);
    req.user = { id: payload.sub };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}
