import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findSummaryStyleViolations } from './summaryStyleCheck.js';

test('findSummaryStyleViolations catches a bare first-person pronoun', () => {
  assert.deepEqual(findSummaryStyleViolations('I am a Full Stack Engineer with 5+ years of experience.'), ['i']);
});

test('findSummaryStyleViolations catches first-person contractions via the same bare "I" match', () => {
  assert.deepEqual(findSummaryStyleViolations("I've built and shipped full-stack products."), ['i']);
});

test('findSummaryStyleViolations catches "my" and "me" as distinct words, deduplicated', () => {
  const result = findSummaryStyleViolations('My work speaks for me, and my results speak for me too.');
  assert.deepEqual(new Set(result), new Set(['my', 'me']));
});

test('findSummaryStyleViolations does not false-positive on "I" as a substring of another word', () => {
  assert.deepEqual(findSummaryStyleViolations('AI Engineer with experience integrating LLMs into production.'), []);
});

test('findSummaryStyleViolations catches an exact banned filler phrase', () => {
  assert.deepEqual(findSummaryStyleViolations('A candidate with a proven track record of delivery.'), [
    'proven track record',
  ]);
});

test('findSummaryStyleViolations catches multiple distinct filler phrases in one summary', () => {
  const result = findSummaryStyleViolations('A results-driven, detail-oriented team player who spearheaded delivery.');
  assert.deepEqual(new Set(result), new Set(['results-driven', 'detail-oriented', 'team player', 'spearheaded']));
});

test('findSummaryStyleViolations catches both a pronoun and a filler phrase together, matching the real reported case', () => {
  const result = findSummaryStyleViolations(
    'I am a Full Stack Product Engineer with over 5 years of experience. ' +
      'I have a strong ability to integrate AI tools. ' +
      'I have a proven track record of building and deploying full-stack solutions.'
  );
  assert.deepEqual(new Set(result), new Set(['i', 'proven track record']));
});

test('findSummaryStyleViolations returns an empty array on a clean, compliant summary', () => {
  assert.deepEqual(
    findSummaryStyleViolations(
      'Full Stack Product Engineer with 5+ years of experience specializing in TypeScript, React, and Node.js. ' +
        'Built and deployed production APIs and designed system architecture across multiple SaaS platforms.'
    ),
    []
  );
});

test('findSummaryStyleViolations is case-insensitive for both pronouns and phrases', () => {
  assert.deepEqual(findSummaryStyleViolations('MY Proven Track Record speaks for itself.'), [
    'my',
    'proven track record',
  ]);
});

test('findSummaryStyleViolations handles empty/undefined input without throwing', () => {
  assert.deepEqual(findSummaryStyleViolations(''), []);
  assert.deepEqual(findSummaryStyleViolations(undefined), []);
});
