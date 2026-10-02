import { OUTREACH_RESPONSE_ENUM } from './validateOutreachCompany.js';

export function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// `userId` is passed through as-is (string or ObjectId) — plain find() auto-
// casts a string userId to ObjectId, unlike aggregate(), which is why
// applications.js's list route needs an explicit ObjectId cast and this one
// doesn't.
export function buildOutreachListQuery(userId, query = {}) {
  const match = { userId };

  if (query.applied === 'true') match.applied = true;
  if (query.applied === 'false') match.applied = false;

  if (OUTREACH_RESPONSE_ENUM.includes(query.response)) {
    match.response = query.response;
  }

  const search = String(query.search || '').trim();
  if (search) {
    match.companyName = { $regex: escapeRegex(search), $options: 'i' };
  }

  return match;
}
