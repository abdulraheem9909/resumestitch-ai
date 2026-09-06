import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { canonicalizeSkill } from './canonicalizeSkill.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const skillAliases = JSON.parse(readFileSync(path.join(__dirname, '__fixtures__/skillAliases.json'), 'utf-8'));

test('canonicalizeSkill resolves a known alias regardless of case', () => {
  assert.equal(canonicalizeSkill('NodeJS', skillAliases), 'node.js');
});

test('canonicalizeSkill strips a trailing parenthetical annotation before matching the dictionary', () => {
  assert.equal(canonicalizeSkill('Retrieval-Augmented Generation ( RAG)', skillAliases), 'rag');
  assert.equal(canonicalizeSkill('Pinecone Vector DB (Pinecone)', skillAliases), 'pinecone');
});

test('canonicalizeSkill falls back to the full normalized string, parenthetical included, when nothing matches either way', () => {
  assert.equal(canonicalizeSkill('Underwater Basket Weaving (UBW)', skillAliases), 'underwater basket weaving (ubw)');
});

test('canonicalizeSkill handles empty input without throwing', () => {
  assert.equal(canonicalizeSkill('', skillAliases), '');
  assert.equal(canonicalizeSkill(undefined, skillAliases), '');
});
