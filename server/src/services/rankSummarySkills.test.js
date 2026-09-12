import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankSummarySkills } from './rankSummarySkills.js';

test('rankSummarySkills returns the list as-is, with no model call, when already at or under the target count', async () => {
  const result = await rankSummarySkills({
    jdText: 'irrelevant for this branch',
    matchedSkills: ['react', 'node.js', 'aws'],
    applicationId: 'app-1',
    resumeVersion: 'resume-1',
  });
  assert.deepEqual(result, ['react', 'node.js', 'aws']);
});

test('rankSummarySkills dedupes before the short-circuit check', async () => {
  const result = await rankSummarySkills({
    jdText: 'irrelevant for this branch',
    matchedSkills: ['react', 'react', 'node.js'],
    applicationId: 'app-1',
    resumeVersion: 'resume-1',
  });
  assert.deepEqual(result, ['react', 'node.js']);
});

test('rankSummarySkills handles an empty matched-skills list without throwing', async () => {
  const result = await rankSummarySkills({
    jdText: 'irrelevant for this branch',
    matchedSkills: [],
    applicationId: 'app-1',
    resumeVersion: 'resume-1',
  });
  assert.deepEqual(result, []);
});

test('rankSummarySkills short-circuits at exactly the target count (4), with no model call', async () => {
  const result = await rankSummarySkills({
    jdText: 'irrelevant for this branch',
    matchedSkills: ['a', 'b', 'c', 'd'],
    applicationId: 'app-1',
    resumeVersion: 'resume-1',
  });
  assert.deepEqual(result, ['a', 'b', 'c', 'd']);
});
