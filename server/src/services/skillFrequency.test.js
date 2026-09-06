import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { computeSkillFrequency } from './skillFrequency.js';
import { buildSkillMatchers } from './skillAliasesStore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const skillAliases = JSON.parse(readFileSync(path.join(__dirname, '__fixtures__/skillAliases.json'), 'utf-8'));
const matchers = buildSkillMatchers(skillAliases);

function bullets(...texts) {
  return texts.map((text) => ({ text }));
}

function frequency(jdSnapshot, resumeBullets, canonicalSkills) {
  return computeSkillFrequency(jdSnapshot, resumeBullets, canonicalSkills, matchers, skillAliases);
}

test('computeSkillFrequency counts exact-match occurrences in JD text and resume bullet text separately', () => {
  const result = frequency(
    'We need React experience. React experience is required.',
    bullets('Built dashboards with React.'),
    ['react']
  );
  assert.deepEqual(result, [{ skill: 'react', resumeCount: 1, jdCount: 2 }]);
});

test('computeSkillFrequency aggregates every known alias into the same canonical skill count', () => {
  const result = frequency(
    'Looking for Node and NodeJS experience.',
    bullets('Built an API with Node.js.', 'Deployed the Node.js service.', 'Wrote Node.js middleware.'),
    ['node.js']
  );
  assert.deepEqual(result, [{ skill: 'node.js', resumeCount: 3, jdCount: 2 }]);
});

test('computeSkillFrequency does not double-count a single mention across overlapping aliases (node vs node.js)', () => {
  const result = frequency('Requires Node.js.', bullets('Built services in Node.js.'), ['node.js']);
  assert.deepEqual(result, [{ skill: 'node.js', resumeCount: 1, jdCount: 1 }]);
});

test('computeSkillFrequency zero-fills a requested skill with no occurrences anywhere, rather than omitting it', () => {
  const result = frequency('Looking for React experience.', bullets('Built APIs with Node.js.'), ['docker']);
  assert.deepEqual(result, [{ skill: 'docker', resumeCount: 0, jdCount: 0 }]);
});

test('computeSkillFrequency falls back to a skill\'s own literal wording when it has no dictionary entry at all', () => {
  const result = frequency(
    'Experience with Cobol required.',
    bullets('Maintained a Cobol mainframe system.'),
    ['cobol']
  );
  assert.deepEqual(result, [{ skill: 'cobol', resumeCount: 1, jdCount: 1 }]);
});

test('computeSkillFrequency matches case-insensitively', () => {
  const result = frequency('REACT required.', bullets('Reviewed react fundamentals.'), ['react']);
  assert.deepEqual(result, [{ skill: 'react', resumeCount: 1, jdCount: 1 }]);
});

test('computeSkillFrequency respects word boundaries — "java" never matches inside "javascript"', () => {
  const result = frequency(
    'Looking for Java and JavaScript experience.',
    bullets('Built frontends with JavaScript.'),
    ['java', 'javascript']
  );
  assert.deepEqual(result, [
    { skill: 'java', resumeCount: 0, jdCount: 1 },
    { skill: 'javascript', resumeCount: 1, jdCount: 1 },
  ]);
});

test('computeSkillFrequency dedupes a canonical skill requested more than once', () => {
  const result = frequency('React required.', bullets('Built with React.'), ['react', 'react']);
  assert.deepEqual(result, [{ skill: 'react', resumeCount: 1, jdCount: 1 }]);
});

test('computeSkillFrequency handles empty/undefined inputs without throwing', () => {
  assert.deepEqual(frequency(undefined, undefined, undefined), []);
  assert.deepEqual(frequency('React required.', bullets('Built with React.'), []), []);
  assert.deepEqual(frequency('', [], ['react']), [{ skill: 'react', resumeCount: 0, jdCount: 0 }]);
});

test('computeSkillFrequency collapses internal whitespace in a multi-word term, same as matchesLiterally', () => {
  const result = frequency(
    'Experience with Amazon   EC2 required.',
    bullets('Deployed on Amazon EC2 instances.'),
    ['amazon ec2']
  );
  assert.deepEqual(result, [{ skill: 'amazon ec2', resumeCount: 1, jdCount: 1 }]);
});

test('computeSkillFrequency never merges a match across two separate bullets', () => {
  // "Node" ending one bullet and "js" starting the next must not combine
  // into a spurious "Nodejs" match once joined for scanning.
  const result = frequency('', bullets('Built services with Node', 'js middleware for the API.'), ['node.js']);
  assert.deepEqual(result, [{ skill: 'node.js', resumeCount: 1, jdCount: 0 }]);
});
