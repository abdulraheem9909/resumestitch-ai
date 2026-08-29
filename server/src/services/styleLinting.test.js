import { test } from 'node:test';
import assert from 'node:assert/strict';
import { styleLinting } from './styleLinting.js';

test('styleLinting returns every bullet it was given, including rejected ones, never dropping any', async () => {
  const tailoredBullets = [
    { bulletId: 'b1', finalText: 'We utilize modern tools to ship features.', rejected: false },
    { bulletId: 'b2', finalText: 'Original bullet text, unchanged.', rejected: true },
  ];

  const result = await styleLinting({
    tailoredBullets,
    tailoredSummary: { finalText: 'A short, clean summary.' },
    coverLetterText: null,
  });

  assert.equal(result.tailoredBullets.length, 2, 'a rejected bullet must still come back in the output array');
  const byId = new Map(result.tailoredBullets.map((bullet) => [bullet.bulletId, bullet]));
  assert.ok(byId.has('b2'), 'rejected bullet must not be dropped');
});

test('styleLinting skips linting a rejected bullet entirely, leaving its text byte-for-byte as given', async () => {
  const tailoredBullets = [
    { bulletId: 'b1', finalText: 'We utilize legacy phrasing on purpose.', rejected: true },
  ];

  const result = await styleLinting({
    tailoredBullets,
    tailoredSummary: { finalText: 'A short, clean summary.' },
    coverLetterText: null,
  });

  assert.equal(
    result.tailoredBullets[0].finalText,
    'We utilize legacy phrasing on purpose.',
    'a rejected bullet is verbatim source text and must never be rewritten by the linter'
  );
});

test('styleLinting still applies the hard cliché pass to a non-rejected bullet', async () => {
  const tailoredBullets = [
    { bulletId: 'b1', finalText: 'We utilize modern tools to ship features.', rejected: false },
  ];

  const result = await styleLinting({
    tailoredBullets,
    tailoredSummary: { finalText: 'A short, clean summary.' },
    coverLetterText: null,
  });

  assert.equal(result.tailoredBullets[0].finalText, 'We use modern tools to ship features.');
});
