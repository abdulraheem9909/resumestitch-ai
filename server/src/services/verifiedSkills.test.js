import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { computeVerifiedSkills } from './verifiedSkills.js';
import { buildSkillMatchers } from './skillAliasesStore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const skillAliases = JSON.parse(readFileSync(path.join(__dirname, '__fixtures__/skillAliases.json'), 'utf-8'));
const matchers = buildSkillMatchers(skillAliases);

function verified(skills, texts) {
  return computeVerifiedSkills(skills, texts, matchers, skillAliases);
}

test('computeVerifiedSkills includes a skill genuinely present in the given text, as an exact match', () => {
  const result = verified(['React', 'Docker'], ['Built a chatbot with React and GPT-4.']);
  assert.deepEqual(result.verifiedSkills, ['React']);
  assert.deepEqual(result.skillMatchTypes, { React: 'exact' });
});

test('computeVerifiedSkills excludes a skill absent from every given text', () => {
  const result = verified(['Docker'], ['Built a chatbot with React and GPT-4.']);
  assert.deepEqual(result.verifiedSkills, []);
  assert.deepEqual(result.skillMatchTypes, {});
});

test('computeVerifiedSkills marks a skill "partial" when only a different alias of it (not its own wording) appears', () => {
  const result = verified(['Node.js'], ['Built an API using NodeJS and Express.']);
  assert.deepEqual(result.verifiedSkills, ['Node.js']);
  assert.deepEqual(result.skillMatchTypes, { 'Node.js': 'partial' });
});

test('computeVerifiedSkills marks a skill "exact" when its own literal wording appears, even alongside other aliases in the dictionary', () => {
  const result = verified(['Node'], ['Built an API using Node and Express.']);
  assert.deepEqual(result.verifiedSkills, ['Node']);
  assert.deepEqual(result.skillMatchTypes, { Node: 'exact' });
});

test('computeVerifiedSkills handles empty inputs without throwing', () => {
  assert.deepEqual(verified([], []), { verifiedSkills: [], skillMatchTypes: {} });
  assert.deepEqual(verified(undefined, undefined), { verifiedSkills: [], skillMatchTypes: {} });
  assert.deepEqual(verified(['React'], []), { verifiedSkills: [], skillMatchTypes: {} });
});

test('computeVerifiedSkills matches a skill tagged with a trailing parenthetical annotation, as a partial match', () => {
  const result = verified(
    ['Retrieval-Augmented Generation ( RAG)'],
    ['An assistant that uses RAG to answer questions.']
  );
  assert.deepEqual(result.verifiedSkills, ['Retrieval-Augmented Generation ( RAG)']);
  assert.deepEqual(result.skillMatchTypes, { 'Retrieval-Augmented Generation ( RAG)': 'partial' });
});

test('computeVerifiedSkills recognizes a methodology/soft skill through its real-world phrasing, not just its own name — a partial match', () => {
  const result = verified(
    ['Mentorship', 'Code Review', 'Docker'],
    ['Mentored 5 junior developers and conducted code reviews to ensure quality.']
  );
  assert.deepEqual(result.verifiedSkills, ['Mentorship', 'Code Review']);
  assert.deepEqual(result.skillMatchTypes, { Mentorship: 'partial', 'Code Review': 'partial' });
});

test('computeVerifiedSkills no longer treats plain AWS as backing an EC2-specific skill claim', () => {
  const result = verified(['AWS', 'Amazon EC2'], ['Deployed the app on AWS.']);
  assert.deepEqual(result.verifiedSkills, ['AWS']);
  assert.deepEqual(result.skillMatchTypes, { AWS: 'exact' });
});

test('computeVerifiedSkills still credits Amazon EC2 when EC2 itself is actually mentioned', () => {
  const result = verified(['Amazon EC2'], ['Deployed the app on AWS EC2 with auto-scaling.']);
  assert.deepEqual(result.verifiedSkills, ['Amazon EC2']);
  assert.deepEqual(result.skillMatchTypes, { 'Amazon EC2': 'partial' });
});
