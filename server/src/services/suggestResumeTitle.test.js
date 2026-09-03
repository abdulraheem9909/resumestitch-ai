import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggestResumeTitle } from './suggestResumeTitle.js';

test('suggestResumeTitle strips a single seniority qualifier', () => {
  assert.equal(suggestResumeTitle('Senior Software Engineer', 'Software Engineer'), 'Software Engineer');
});

test('suggestResumeTitle strips a multi-word qualifier phrase', () => {
  assert.equal(suggestResumeTitle('Head of Engineering', 'Software Engineer'), 'Engineering');
});

test('suggestResumeTitle is a no-op when the JD title has no qualifier', () => {
  assert.equal(suggestResumeTitle('Full-Stack Engineer', 'Software Engineer'), 'Full-Stack Engineer');
});

test('suggestResumeTitle falls back to the resume title when stripping leaves nothing usable', () => {
  assert.equal(suggestResumeTitle('Senior', 'Software Engineer'), 'Software Engineer');
});

test('suggestResumeTitle falls back to the resume title when jdTitle is empty', () => {
  assert.equal(suggestResumeTitle('', 'Software Engineer'), 'Software Engineer');
  assert.equal(suggestResumeTitle(undefined, 'Software Engineer'), 'Software Engineer');
});

test('suggestResumeTitle strips qualifiers case-insensitively and collapses leftover whitespace', () => {
  assert.equal(suggestResumeTitle('SENIOR   Full Stack Engineer', 'Software Engineer'), 'Full Stack Engineer');
});
