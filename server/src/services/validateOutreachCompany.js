export const OUTREACH_RESPONSE_ENUM = ['No reply', 'Replied', 'Interview', 'Offer', 'Rejected'];
export const CONTACT_CATEGORY_ENUM = ['Leadership', 'Talent & HR', 'Employee', 'Other'];

// Deliberately permissive, not RFC 5322 — matches the "good enough to catch
// typos" bar this repo has never needed a stricter email check for elsewhere
// (auth.js only checks presence, not format).
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateOutreachCompany(payload) {
  const errors = [];
  const body = payload && typeof payload === 'object' ? payload : {};

  if (typeof body.companyName !== 'string' || !body.companyName.trim()) {
    errors.push('companyName is required.');
  }
  if (body.location != null && typeof body.location !== 'string') {
    errors.push('location must be a string.');
  }
  // No format enforcement — same permissiveness as Application.referenceUrl,
  // which is never validated as a real URL either, since it's just saved and
  // displayed, never fetched.
  if (body.websiteUrl != null && typeof body.websiteUrl !== 'string') {
    errors.push('websiteUrl must be a string.');
  }
  if (body.masterResumeId != null && typeof body.masterResumeId !== 'string') {
    errors.push('masterResumeId must be a string.');
  }
  if (body.notes != null && typeof body.notes !== 'string') {
    errors.push('notes must be a string.');
  }
  if (body.applied != null && typeof body.applied !== 'boolean') {
    errors.push('applied must be a boolean.');
  }
  if (body.response != null && !OUTREACH_RESPONSE_ENUM.includes(body.response)) {
    errors.push(`response must be one of: ${OUTREACH_RESPONSE_ENUM.join(', ')}.`);
  }

  if (body.contacts != null) {
    if (!Array.isArray(body.contacts)) {
      errors.push('contacts must be an array.');
    } else {
      body.contacts.forEach((contact, index) => {
        if (!contact || typeof contact !== 'object') {
          errors.push(`contacts[${index}] must be an object.`);
          return;
        }
        if (typeof contact.name !== 'string' || !contact.name.trim()) {
          errors.push(`contacts[${index}].name is required.`);
        }
        if (contact.role != null && typeof contact.role !== 'string') {
          errors.push(`contacts[${index}].role must be a string.`);
        }
        if (
          contact.email != null &&
          contact.email !== '' &&
          typeof contact.email === 'string' &&
          !EMAIL_REGEX.test(contact.email)
        ) {
          errors.push(`contacts[${index}].email is not a valid email address.`);
        }
        if (contact.category != null && !CONTACT_CATEGORY_ENUM.includes(contact.category)) {
          errors.push(`contacts[${index}].category must be one of: ${CONTACT_CATEGORY_ENUM.join(', ')}.`);
        }
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

// Builds the exact object to persist — trims strings, defaults the enum, and
// strips anything not in this exact field list (including any stray `_id` a
// contact object might carry from the client) so "nothing extra" holds even
// before Mongoose's own strict-mode stripping kicks in.
export function normalizeOutreachCompanyPayload(payload) {
  const body = payload && typeof payload === 'object' ? payload : {};
  const contacts = Array.isArray(body.contacts) ? body.contacts : [];
  return {
    companyName: String(body.companyName || '').trim(),
    location: String(body.location || '').trim(),
    websiteUrl: String(body.websiteUrl || '').trim(),
    masterResumeId: String(body.masterResumeId || '').trim(),
    notes: String(body.notes || '').trim(),
    applied: Boolean(body.applied),
    response: OUTREACH_RESPONSE_ENUM.includes(body.response) ? body.response : 'No reply',
    contacts: contacts.map((contact) => ({
      name: String(contact?.name || '').trim(),
      role: String(contact?.role || '').trim(),
      email: String(contact?.email || '').trim(),
      category: CONTACT_CATEGORY_ENUM.includes(contact?.category) ? contact.category : 'Other',
    })),
  };
}
