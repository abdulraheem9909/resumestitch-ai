import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { gapAnalysis, deriveJdCanonicalSkills } from './gapAnalysis.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const skillAliases = JSON.parse(readFileSync(path.join(__dirname, '__fixtures__/skillAliases.json'), 'utf-8'));

test('gapAnalysis returns JD skills not present in the resume skill set', () => {
  const result = gapAnalysis(['react', 'node.js', 'docker'], ['react', 'node.js']);
  assert.deepEqual(result, ['docker']);
});

test('gapAnalysis handles empty/missing input without throwing', () => {
  assert.deepEqual(gapAnalysis([], []), []);
  assert.deepEqual(gapAnalysis(undefined, undefined), []);
});

// Real-world repro: a JD self-canonicalized "Tailwind CSS" to the raw,
// un-hyphenated "tailwind css" before the dictionary had ever heard of it.
// The dictionary later learns the "official" canonical id "tailwind-css" for
// that same phrase (e.g. via a resume upload or a hand-edited bullet) — the
// JD's own already-computed jdCanonicalSkills snapshot never finds out, so a
// resume that genuinely covers "Tailwind CSS" keeps showing it as a false
// gap forever unless the JD side is re-derived from its raw wording against
// the current dictionary every time, exactly like the resume side already is.
test('deriveJdCanonicalSkills re-derives from raw jdKeywords against the current dictionary, instead of trusting a frozen jdCanonicalSkills snapshot', () => {
  const jdKeywords = { skills: ['Tailwind CSS'], tools: [] };
  const staleJdCanonicalSkills = ['tailwind css'];
  const aliasesWithNewMapping = { 'tailwind css': 'tailwind-css', 'tailwind-css': 'tailwind-css' };

  const result = deriveJdCanonicalSkills(jdKeywords, staleJdCanonicalSkills, aliasesWithNewMapping);
  assert.deepEqual(result, ['tailwind-css']);
});

test('deriveJdCanonicalSkills falls back to the given jdCanonicalSkills verbatim when jdKeywords is absent', () => {
  const result = deriveJdCanonicalSkills(undefined, ['docker', 'git'], skillAliases);
  assert.deepEqual(result, ['docker', 'git']);
});

test('deriveJdCanonicalSkills combines skills and tools and dedupes/canonicalizes them', () => {
  const jdKeywords = { skills: ['NodeJS'], tools: ['Node.js', 'Git'] };
  const result = deriveJdCanonicalSkills(jdKeywords, [], skillAliases);
  assert.deepEqual(new Set(result), new Set(['node.js', 'git']));
});
