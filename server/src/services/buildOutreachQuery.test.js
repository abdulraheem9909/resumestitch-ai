import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildOutreachListQuery, escapeRegex } from './buildOutreachQuery.js';

test('returns just the userId match when no filters are given', () => {
  const match = buildOutreachListQuery('u1', {});
  assert.deepEqual(match, { userId: 'u1' });
});

test('sets applied true/false only for the exact string "true"/"false"', () => {
  assert.equal(buildOutreachListQuery('u1', { applied: 'true' }).applied, true);
  assert.equal(buildOutreachListQuery('u1', { applied: 'false' }).applied, false);
  assert.equal(buildOutreachListQuery('u1', { applied: 'nonsense' }).applied, undefined);
});

test('sets response only when it is a valid enum value, ignoring anything else', () => {
  assert.equal(buildOutreachListQuery('u1', { response: 'Interview' }).response, 'Interview');
  assert.equal(buildOutreachListQuery('u1', { response: 'Ghosted' }).response, undefined);
});

test('builds a case-insensitive regex on companyName from a search term', () => {
  const match = buildOutreachListQuery('u1', { search: 'acme' });
  assert.deepEqual(match.companyName, { $regex: 'acme', $options: 'i' });
});

test('ignores a blank/whitespace-only search term', () => {
  const match = buildOutreachListQuery('u1', { search: '   ' });
  assert.equal(match.companyName, undefined);
});

test('escapeRegex escapes every regex special character', () => {
  const raw = 'Acme (Inc.)+*?[test]';
  const escaped = escapeRegex(raw);
  const regex = new RegExp(escaped, 'i');
  assert.ok(regex.test(raw));
});

test('combines applied, response, and search into one match object', () => {
  const match = buildOutreachListQuery('u1', { applied: 'true', response: 'Offer', search: 'acme' });
  assert.deepEqual(match, {
    userId: 'u1',
    applied: true,
    response: 'Offer',
    companyName: { $regex: 'acme', $options: 'i' },
  });
});
