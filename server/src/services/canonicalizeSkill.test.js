import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalizeSkill } from './canonicalizeSkill.js';

test('canonicalizeSkill resolves a known alias regardless of case', () => {
  assert.equal(canonicalizeSkill('NodeJS'), 'node.js');
});

test('canonicalizeSkill strips a trailing parenthetical annotation before matching the dictionary', () => {
  assert.equal(canonicalizeSkill('Retrieval-Augmented Generation ( RAG)'), 'rag');
  assert.equal(canonicalizeSkill('Pinecone Vector DB (Pinecone)'), 'pinecone');
});

test('canonicalizeSkill falls back to the full normalized string, parenthetical included, when nothing matches either way', () => {
  assert.equal(canonicalizeSkill('Underwater Basket Weaving (UBW)'), 'underwater basket weaving (ubw)');
});

test('canonicalizeSkill handles empty input without throwing', () => {
  assert.equal(canonicalizeSkill(''), '');
  assert.equal(canonicalizeSkill(undefined), '');
});
