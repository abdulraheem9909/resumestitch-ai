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

test('styleLinting leaves a human-edited bullet byte-for-byte unchanged even when it contains a hard cliché word', async () => {
  const tailoredBullets = [
    {
      bulletId: 'b1',
      finalText: 'Utilized a deterministic caching layer to cut latency.',
      rejected: false,
      editSource: 'human',
    },
  ];

  const result = await styleLinting({
    tailoredBullets,
    tailoredSummary: { finalText: 'A short, clean summary.' },
    coverLetterText: null,
  });

  assert.equal(
    result.tailoredBullets[0].finalText,
    'Utilized a deterministic caching layer to cut latency.',
    'a human-edited bullet must survive a retry unchanged, even if it contains a word the linter would otherwise rewrite'
  );
});

test('styleLinting leaves a human-edited summary byte-for-byte unchanged even when it contains an em dash that would trigger escalation', async () => {
  const tailoredSummary = {
    finalText: 'Backend engineer — deep experience with distributed systems.',
    editSource: 'human',
  };

  const result = await styleLinting({
    tailoredBullets: [],
    tailoredSummary,
    coverLetterText: null,
  });

  assert.equal(
    result.tailoredSummary.finalText,
    'Backend engineer — deep experience with distributed systems.',
    'a human-edited summary must survive a retry unchanged, even if it contains an escalation trigger'
  );
});
