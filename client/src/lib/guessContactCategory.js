// Deliberately duplicated from server/src/services/validateOutreachCompany.js's
// CONTACT_CATEGORY_ENUM — no shared package exists between client/ and
// server/ in this repo, so a 4-item list is simpler to keep in sync by hand
// than to add shared-package tooling for. The value picked here is only ever
// a starting suggestion — the server validates whatever is actually saved.
export const CONTACT_CATEGORIES = ['Leadership', 'Talent & HR', 'Employee', 'Other'];

// Same "explicit short hand-list, not a broad pattern" precedent as
// SENIORITY_QUALIFIER_TERMS in suggestResumeTitle.js on the backend.
const LEADERSHIP_TERMS = ['founder', 'co-founder', 'ceo', 'cto', 'coo', 'cfo', 'president', 'chief', 'vp', 'vice president'];
const TALENT_TERMS = ['talent', 'recruit', 'hr', 'human resources', 'people'];

export function guessContactCategory(role) {
  const normalized = (role || '').toLowerCase();
  if (!normalized.trim()) return 'Other';
  if (LEADERSHIP_TERMS.some((term) => normalized.includes(term))) return 'Leadership';
  if (TALENT_TERMS.some((term) => normalized.includes(term))) return 'Talent & HR';
  return 'Employee';
}
