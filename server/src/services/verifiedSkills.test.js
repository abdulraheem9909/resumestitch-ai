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

test('computeVerifiedSkills matches a skill tagged with a trailing parenthetical annotation', () => {
  const result = computeVerifiedSkills(
    ['Retrieval-Augmented Generation ( RAG)'],
    ['An assistant that uses RAG to answer questions.']
  );
  assert.deepEqual(result, ['Retrieval-Augmented Generation ( RAG)']);
});

test('computeVerifiedSkills recognizes a methodology/soft skill through its real-world phrasing, not just its own name', () => {
  const result = computeVerifiedSkills(
    ['Mentorship', 'Code Review', 'Docker'],
    ['Mentored 5 junior developers and conducted code reviews to ensure quality.']
  );
  assert.deepEqual(result, ['Mentorship', 'Code Review']);
});
