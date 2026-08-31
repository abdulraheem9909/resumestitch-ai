import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeOverlap, roleFitGate } from './roleFitGate.js';

test('computeOverlap returns null when jdCanonicalSkills is undefined', () => {
  assert.equal(computeOverlap(undefined, ['react']), null);
});

test('computeOverlap returns null when jdCanonicalSkills is empty', () => {
  assert.equal(computeOverlap([], ['react']), null);
});

test('computeOverlap returns 1 when every JD skill is present in the resume skills', () => {
  assert.equal(computeOverlap(['react', 'node.js'], ['react', 'node.js', 'aws']), 1);
});

test('computeOverlap returns 0 when no JD skill is present in the resume skills — a same-discipline, different-stack JD produces this same signal as a genuine cross-discipline mismatch, so this is no longer treated as a rejection signal on its own', () => {
  assert.equal(computeOverlap(['java', 'spring'], ['react', 'node.js']), 0);
});

test('computeOverlap returns the correct fraction for a partial match', () => {
  assert.equal(computeOverlap(['a', 'b', 'c', 'd', 'e'], ['a']), 0.2);
});

test('computeOverlap tolerates resumeCanonicalSkills being undefined or null', () => {
  assert.equal(computeOverlap(['react'], undefined), 0);
  assert.equal(computeOverlap(['react'], null), 0);
});

test('roleFitGate fast-passes at exactly the confident threshold (50%) with no model call', async () => {
  const result = await roleFitGate({
    jdText: 'irrelevant for this branch',
    jdCanonicalSkills: ['react', 'node.js'],
    resumeCanonicalSkills: ['react'],
  });
  assert.equal(result.fit, 'plausible');
  assert.match(result.reason, /50%/);
});

test('roleFitGate fast-passes above the confident threshold with no model call', async () => {
  const result = await roleFitGate({
    jdText: 'irrelevant for this branch',
    jdCanonicalSkills: ['react', 'node.js', 'aws', 'typescript', 'graphql'],
    resumeCanonicalSkills: ['react', 'node.js', 'aws', 'typescript'],
  });
  assert.equal(result.fit, 'plausible');
  assert.match(result.reason, /80%/);
});
