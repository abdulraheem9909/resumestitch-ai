import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeVerifiedSkills } from './verifiedSkills.js';

test('computeVerifiedSkills includes a skill genuinely present in the given text, as an exact match', () => {
  const result = computeVerifiedSkills(['React', 'Docker'], ['Built a chatbot with React and GPT-4.']);
  assert.deepEqual(result.verifiedSkills, ['React']);
  assert.deepEqual(result.skillMatchTypes, { React: 'exact' });
});

test('computeVerifiedSkills excludes a skill absent from every given text', () => {
  const result = computeVerifiedSkills(['Docker'], ['Built a chatbot with React and GPT-4.']);
  assert.deepEqual(result.verifiedSkills, []);
  assert.deepEqual(result.skillMatchTypes, {});
});

test('computeVerifiedSkills marks a skill "partial" when only a different alias of it (not its own wording) appears', () => {
  const result = computeVerifiedSkills(['Node.js'], ['Built an API using NodeJS and Express.']);
  assert.deepEqual(result.verifiedSkills, ['Node.js']);
  assert.deepEqual(result.skillMatchTypes, { 'Node.js': 'partial' });
});

test('computeVerifiedSkills marks a skill "exact" when its own literal wording appears, even alongside other aliases in the dictionary', () => {
  const result = computeVerifiedSkills(['Node'], ['Built an API using Node and Express.']);
  assert.deepEqual(result.verifiedSkills, ['Node']);
  assert.deepEqual(result.skillMatchTypes, { Node: 'exact' });
});

test('computeVerifiedSkills handles empty inputs without throwing', () => {
  assert.deepEqual(computeVerifiedSkills([], []), { verifiedSkills: [], skillMatchTypes: {} });
  assert.deepEqual(computeVerifiedSkills(undefined, undefined), { verifiedSkills: [], skillMatchTypes: {} });
  assert.deepEqual(computeVerifiedSkills(['React'], []), { verifiedSkills: [], skillMatchTypes: {} });
});

test('computeVerifiedSkills matches a skill tagged with a trailing parenthetical annotation, as a partial match', () => {
  const result = computeVerifiedSkills(
    ['Retrieval-Augmented Generation ( RAG)'],
    ['An assistant that uses RAG to answer questions.']
  );
  assert.deepEqual(result.verifiedSkills, ['Retrieval-Augmented Generation ( RAG)']);
  assert.deepEqual(result.skillMatchTypes, { 'Retrieval-Augmented Generation ( RAG)': 'partial' });
});

test('computeVerifiedSkills recognizes a methodology/soft skill through its real-world phrasing, not just its own name — a partial match', () => {
  const result = computeVerifiedSkills(
    ['Mentorship', 'Code Review', 'Docker'],
    ['Mentored 5 junior developers and conducted code reviews to ensure quality.']
  );
  assert.deepEqual(result.verifiedSkills, ['Mentorship', 'Code Review']);
  assert.deepEqual(result.skillMatchTypes, { Mentorship: 'partial', 'Code Review': 'partial' });
});

test('computeVerifiedSkills no longer treats plain AWS as backing an EC2-specific skill claim', () => {
  const result = computeVerifiedSkills(['AWS', 'Amazon EC2'], ['Deployed the app on AWS.']);
  assert.deepEqual(result.verifiedSkills, ['AWS']);
  assert.deepEqual(result.skillMatchTypes, { AWS: 'exact' });
});

test('computeVerifiedSkills still credits Amazon EC2 when EC2 itself is actually mentioned', () => {
  const result = computeVerifiedSkills(['Amazon EC2'], ['Deployed the app on AWS EC2 with auto-scaling.']);
  assert.deepEqual(result.verifiedSkills, ['Amazon EC2']);
  assert.deepEqual(result.skillMatchTypes, { 'Amazon EC2': 'partial' });
});
