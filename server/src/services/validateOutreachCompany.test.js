import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateOutreachCompany,
  normalizeOutreachCompanyPayload,
  OUTREACH_RESPONSE_ENUM,
  CONTACT_CATEGORY_ENUM,
} from './validateOutreachCompany.js';

test('rejects a payload missing companyName', () => {
  const { valid, errors } = validateOutreachCompany({});
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes('companyName')));
});

test('accepts companyName with no other fields', () => {
  const { valid } = validateOutreachCompany({ companyName: 'Acme' });
  assert.equal(valid, true);
});

test('accepts an explicitly empty contacts array', () => {
  const { valid } = validateOutreachCompany({ companyName: 'Acme', contacts: [] });
  assert.equal(valid, true);
});

test('rejects a contact missing a name', () => {
  const { valid, errors } = validateOutreachCompany({
    companyName: 'Acme',
    contacts: [{ role: 'CTO' }],
  });
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes('contacts[0].name')));
});

test('rejects a contact with a malformed email', () => {
  const { valid, errors } = validateOutreachCompany({
    companyName: 'Acme',
    contacts: [{ name: 'Jo', email: 'not-an-email' }],
  });
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes('contacts[0].email')));
});

test('accepts a contact with a well-formed email', () => {
  const { valid } = validateOutreachCompany({
    companyName: 'Acme',
    contacts: [{ name: 'Jo', email: 'jo@acme.com' }],
  });
  assert.equal(valid, true);
});

test('accepts a contact with no email at all', () => {
  const { valid } = validateOutreachCompany({
    companyName: 'Acme',
    contacts: [{ name: 'Jo' }],
  });
  assert.equal(valid, true);
});

test('rejects an invalid response enum value', () => {
  const { valid, errors } = validateOutreachCompany({ companyName: 'Acme', response: 'Ghosted' });
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes('response')));
});

test('accepts every valid response enum value', () => {
  for (const response of OUTREACH_RESPONSE_ENUM) {
    const { valid } = validateOutreachCompany({ companyName: 'Acme', response });
    assert.equal(valid, true, `expected "${response}" to be valid`);
  }
});

test('accepts a fully populated valid payload with multiple contacts', () => {
  const { valid } = validateOutreachCompany({
    companyName: 'Acme',
    location: 'NYC',
    notes: 'Met at a meetup',
    applied: true,
    response: 'Interview',
    contacts: [
      { name: 'Jo Smith', role: 'CTO', email: 'jo@acme.com' },
      { name: 'Ana Lee', role: 'Talent Partner', email: '' },
      { name: 'Sam Park' },
    ],
  });
  assert.equal(valid, true);
});

test('normalizeOutreachCompanyPayload trims strings and drops unknown contact fields', () => {
  const result = normalizeOutreachCompanyPayload({
    companyName: '  Acme  ',
    contacts: [{ _id: 'x', name: ' Jo ', extra: 'nope' }],
  });
  assert.equal(result.companyName, 'Acme');
  assert.deepEqual(result.contacts, [{ name: 'Jo', role: '', email: '', category: 'Other' }]);
});

test('accepts a payload with no websiteUrl at all', () => {
  const { valid } = validateOutreachCompany({ companyName: 'Acme' });
  assert.equal(valid, true);
});

test('websiteUrl is never format-checked — any string is accepted, matching referenceUrl elsewhere', () => {
  const { valid } = validateOutreachCompany({ companyName: 'Acme', websiteUrl: 'not a url at all' });
  assert.equal(valid, true);
});

test('normalizeOutreachCompanyPayload trims websiteUrl and defaults it to an empty string', () => {
  assert.equal(
    normalizeOutreachCompanyPayload({ companyName: 'Acme', websiteUrl: '  https://acme.com  ' }).websiteUrl,
    'https://acme.com'
  );
  assert.equal(normalizeOutreachCompanyPayload({ companyName: 'Acme' }).websiteUrl, '');
});

test('normalizeOutreachCompanyPayload defaults response to "No reply" when missing or invalid', () => {
  assert.equal(normalizeOutreachCompanyPayload({ companyName: 'Acme' }).response, 'No reply');
  assert.equal(
    normalizeOutreachCompanyPayload({ companyName: 'Acme', response: 'Ghosted' }).response,
    'No reply'
  );
});

test('accepts a payload with no masterResumeId at all', () => {
  const { valid } = validateOutreachCompany({ companyName: 'Acme' });
  assert.equal(valid, true);
});

test('rejects a non-string masterResumeId', () => {
  const { valid, errors } = validateOutreachCompany({ companyName: 'Acme', masterResumeId: 42 });
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes('masterResumeId')));
});

test('accepts every valid contact category', () => {
  for (const category of CONTACT_CATEGORY_ENUM) {
    const { valid } = validateOutreachCompany({
      companyName: 'Acme',
      contacts: [{ name: 'Jo', category }],
    });
    assert.equal(valid, true, `expected category "${category}" to be valid`);
  }
});

test('rejects an invalid contact category', () => {
  const { valid, errors } = validateOutreachCompany({
    companyName: 'Acme',
    contacts: [{ name: 'Jo', category: 'Astronaut' }],
  });
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes('category')));
});

test('normalizeOutreachCompanyPayload trims masterResumeId and defaults it to an empty string', () => {
  assert.equal(
    normalizeOutreachCompanyPayload({ companyName: 'Acme', masterResumeId: '  64f0a1b2c3d4e5f6a7b8c9d0  ' }).masterResumeId,
    '64f0a1b2c3d4e5f6a7b8c9d0'
  );
  assert.equal(normalizeOutreachCompanyPayload({ companyName: 'Acme' }).masterResumeId, '');
});

test('normalizeOutreachCompanyPayload defaults an invalid or missing contact category to "Other"', () => {
  const result = normalizeOutreachCompanyPayload({
    companyName: 'Acme',
    contacts: [{ name: 'Jo', category: 'Astronaut' }, { name: 'Ana' }],
  });
  assert.equal(result.contacts[0].category, 'Other');
  assert.equal(result.contacts[1].category, 'Other');
});

test('normalizeOutreachCompanyPayload keeps a valid contact category', () => {
  const result = normalizeOutreachCompanyPayload({
    companyName: 'Acme',
    contacts: [{ name: 'Jo', category: 'Leadership' }],
  });
  assert.equal(result.contacts[0].category, 'Leadership');
});
