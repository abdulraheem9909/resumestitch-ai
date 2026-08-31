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
