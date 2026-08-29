import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTailoredBullets } from './tailorContent.js';

function candidates(entries) {
  return new Map(entries.map((bullet) => [bullet.bulletId, bullet]));
}

test('buildTailoredBullets builds one tailored bullet per model entry that matches a real candidate', () => {
  const candidatesById = candidates([
    { bulletId: 'src-1', text: 'Original bullet one.' },
    { bulletId: 'src-2', text: 'Original bullet two.' },
  ]);
  const modelBullets = [
    { bulletId: 'src-1', rejected: false, tailoredText: 'Tailored bullet one.' },
    { bulletId: 'src-2', rejected: true, tailoredText: 'ignored for rejected bullets' },
  ];

  const result = buildTailoredBullets(modelBullets, candidatesById);

  assert.equal(result.length, 2);
  assert.equal(result[0].sourceBulletId, 'src-1');
  assert.equal(result[0].finalText, 'Tailored bullet one.');
  assert.equal(result[0].rejected, false);
  assert.equal(result[1].sourceBulletId, 'src-2');
  assert.equal(result[1].finalText, 'Original bullet two.', 'a rejected bullet is forced back to verbatim source text');
  assert.equal(result[1].rejected, true);
  assert.equal(result[1].rephraseIntensity, 0);
});

test('buildTailoredBullets drops a model entry whose bulletId matches no real candidate', () => {
  const candidatesById = candidates([{ bulletId: 'src-1', text: 'Original bullet one.' }]);
  const modelBullets = [
    { bulletId: 'src-1', rejected: false, tailoredText: 'Tailored bullet one.' },
    { bulletId: 'invented-id', rejected: false, tailoredText: 'Should never appear.' },
  ];

  const result = buildTailoredBullets(modelBullets, candidatesById);

  assert.equal(result.length, 1);
  assert.equal(result[0].sourceBulletId, 'src-1');
});

test('buildTailoredBullets includes any candidate the model silently omitted, verbatim and unrejected', () => {
  const candidatesById = candidates([
    { bulletId: 'src-1', text: 'Original bullet one.' },
    { bulletId: 'src-2', text: 'Original bullet two.' },
    { bulletId: 'src-3', text: 'Original bullet three.' },
  ]);
  // The model only returned an entry for src-1 and src-3 — src-2 was dropped
  // from its response entirely, which is not the same thing as rejecting it.
  const modelBullets = [
    { bulletId: 'src-1', rejected: false, tailoredText: 'Tailored bullet one.' },
    { bulletId: 'src-3', rejected: false, tailoredText: 'Tailored bullet three.' },
  ];

  const result = buildTailoredBullets(modelBullets, candidatesById);

  assert.equal(result.length, 3, 'the omitted candidate must still end up in the tailored set');
  const bySource = new Map(result.map((bullet) => [bullet.sourceBulletId, bullet]));
  assert.equal(bySource.get('src-2').finalText, 'Original bullet two.');
  assert.equal(bySource.get('src-2').rejected, false, 'an omission is never treated as a rejection');
  assert.equal(bySource.get('src-2').rephraseIntensity, 0);
});
