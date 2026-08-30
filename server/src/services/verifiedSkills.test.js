import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeVerifiedSkills } from './verifiedSkills.js';

test('computeVerifiedSkills includes a skill genuinely present in the given text', () => {
  const result = computeVerifiedSkills(['React', 'Docker'], ['Built a chatbot with React and GPT-4.']);
  assert.deepEqual(result, ['React']);
});

test('computeVerifiedSkills excludes a skill absent from every given text', () => {
  const result = computeVerifiedSkills(['Docker'], ['Built a chatbot with React and GPT-4.']);
  assert.deepEqual(result, []);
});

test('computeVerifiedSkills matches through aliases/case, not literal string equality', () => {
  const result = computeVerifiedSkills(['Node.js'], ['Built an API using NodeJS and Express.']);
  assert.deepEqual(result, ['Node.js']);
});

test('computeVerifiedSkills handles empty inputs without throwing', () => {
  assert.deepEqual(computeVerifiedSkills([], []), []);
  assert.deepEqual(computeVerifiedSkills(undefined, undefined), []);
  assert.deepEqual(computeVerifiedSkills(['React'], []), []);
});
