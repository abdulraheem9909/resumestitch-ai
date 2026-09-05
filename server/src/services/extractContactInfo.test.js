import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractContactInfo } from './extractContactInfo.js';

test('extracts full name, title, location, phone, email, LinkedIn, and portfolio from a real resume preamble', () => {
  const rawText = [
    'Abdul Raheem',
    'Manchester, UK, England • +447700900123 • abdul.raheem@example.com •',
    'linkedin.com/in/abdulraheem-dev • https://abdul-portfolio.vercel.app',
    'Software Engineer',
    'Software developer with 5+ years of experience delivering impactful solutions.',
    'WORK EXPERIENCE',
    'Fullstack Engineer • Freelancer 09/2024 - Present',
    '● Built things.',
  ].join('\n');

  const result = extractContactInfo(rawText);

  assert.deepEqual(result, {
    fullName: 'Abdul Raheem',
    title: 'Software Engineer',
    location: 'Manchester, UK, England',
    phone: '+447700900123',
    email: 'abdul.raheem@example.com',
    linkedin: 'linkedin.com/in/abdulraheem-dev',
    portfolio: 'https://abdul-portfolio.vercel.app',
  });
});

test('stops at the first section heading and never reads past the preamble', () => {
  const rawText = [
    'Jane Doe',
    'jane@example.com',
    'SUMMARY',
    'An experienced engineer with 555-123-4567 mentioned only in a bullet, not the header.',
    'WORK EXPERIENCE',
  ].join('\n');

  const result = extractContactInfo(rawText);

  assert.equal(result.fullName, 'Jane Doe');
  assert.equal(result.email, 'jane@example.com');
  assert.equal(result.phone, '');
});

test('returns all-empty fields for empty input without throwing', () => {
  assert.deepEqual(extractContactInfo(''), {
    fullName: '',
    title: '',
    location: '',
    phone: '',
    email: '',
    linkedin: '',
    portfolio: '',
  });
  assert.deepEqual(extractContactInfo(undefined), {
    fullName: '',
    title: '',
    location: '',
    phone: '',
    email: '',
    linkedin: '',
    portfolio: '',
  });
});

test('leaves location blank when the contact line has no leftover text after phone/email/links', () => {
  const rawText = ['Sam Lee', '+15551234567 • sam@example.com', 'Backend Developer'].join('\n');

  const result = extractContactInfo(rawText);

  assert.equal(result.location, '');
  assert.equal(result.title, 'Backend Developer');
});

// Real-world repro: a resume whose actual name never appears in the header
// block at all (a multi-column PDF layout artifact — the real name shows up
// deep inside the Work Experience section instead) opens with its tagline
// on line 0. The old code unconditionally trusted line 0 as the name,
// silently prefilling a job title as someone's name.
test('leaves fullName blank rather than guessing wrong when line 0 is actually a tagline', () => {
  const rawText = [
    'Senior/ Lead Flutter Developer',
    'maan852@live.com',
    'https://www.linkedin.com/in/abdul-rehman-55397a1b5',
    '+92 303 4923706',
    'Dubai, 00000, United Arab Emirates',
    'Experienced Flutter Developer with 6+ years in mobile and web app development.',
    'Work Experience',
  ].join('\n');

  const result = extractContactInfo(rawText);

  assert.equal(result.fullName, '');
  assert.equal(result.title, 'Senior/ Lead Flutter Developer');
  assert.equal(result.location, 'Dubai, 00000, United Arab Emirates');
  assert.equal(result.phone, '+92 303 4923706');
  assert.equal(result.email, 'maan852@live.com');
  assert.equal(result.linkedin, 'https://www.linkedin.com/in/abdul-rehman-55397a1b5');
});

// Real-world repro: a bare location line with no phone/email/URL on it at
// all never reaches looksLikeContactLine, so it needs its own check —
// and the contact line before it (email only, nothing left over) must not
// have already locked locationCaptured true with nothing found.
test('captures a bare location line on its own, separate from the contact-info lines', () => {
  const rawText = ['Jordan Kim', 'jordan@example.com', 'Berlin, Germany', 'Product Designer'].join('\n');

  const result = extractContactInfo(rawText);

  assert.equal(result.fullName, 'Jordan Kim');
  assert.equal(result.location, 'Berlin, Germany');
  assert.equal(result.title, 'Product Designer');
});
