import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDate } from './normalizeDate.js';

test('passes an already-canonical numeric range through unchanged', () => {
  assert.equal(normalizeDate('09/2024 - 01/2026'), '09/2024 - 01/2026');
});

test('reformats a named-month range to MM/YYYY', () => {
  assert.equal(normalizeDate('Sep 2015 - Jun 2020'), '09/2015 - 06/2020');
});

test('reformats a no-separator multi-column range (dash stranded on its own line)', () => {
  assert.equal(normalizeDate('Sep 2015 Jun 2020'), '09/2015 - 06/2020');
});

test('preserves Present in a range and reformats the start month', () => {
  assert.equal(normalizeDate('Oct 2023 - Present'), '10/2023 - Present');
});

test('recognizes Present even with no connecting separator', () => {
  assert.equal(normalizeDate('Oct 2023 Present'), '10/2023 - Present');
});

test('leaves a bare-year range unchanged — no month to convert without inventing one', () => {
  assert.equal(normalizeDate('2020 - 2021'), '2020 - 2021');
});

test('reformats a single named-month date (a certification date)', () => {
  assert.equal(normalizeDate('Nov 2018'), '11/2018');
});

test('leaves a single bare year unchanged', () => {
  assert.equal(normalizeDate('2015'), '2015');
});

test('handles empty and undefined input without throwing', () => {
  assert.equal(normalizeDate(''), '');
  assert.equal(normalizeDate(undefined), '');
});

test('recognizes a long-form month name, not just the 3-letter abbreviation', () => {
  assert.equal(normalizeDate('September 2015 - June 2020'), '09/2015 - 06/2020');
});
