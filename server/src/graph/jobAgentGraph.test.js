import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  gapAnalysisNode,
  mergeHumanEditedBullets,
  ensureRequiredBulletIncluded,
  ensureEveryEmployerRepresented,
} from './jobAgentGraph.js';
import { normalizeSkills } from '../services/normalizeSkills.js';

test('gapAnalysisNode recomputes resumeCanonicalSkills from current resumeBullets and shrinks keywordGaps when a missing skill is added', () => {
  const jdCanonicalSkills = ['node.js', 'express', 'git'];
  const resumeBullets = [
    { bulletId: '1', canonicalSkills: ['node.js', 'react'] },
  ];

  const before = gapAnalysisNode({ jdCanonicalSkills, resumeBullets });
  assert.deepEqual(before.resumeCanonicalSkills, ['node.js', 'react']);
  assert.deepEqual(before.keywordGaps, ['express', 'git']);

  const resumeBulletsWithNewBullet = [
    ...resumeBullets,
    { bulletId: '2', canonicalSkills: ['express', 'git'] },
  ];

  const after = gapAnalysisNode({ jdCanonicalSkills, resumeBullets: resumeBulletsWithNewBullet });
  assert.deepEqual(new Set(after.resumeCanonicalSkills), new Set(['node.js', 'react', 'express', 'git']));
  assert.deepEqual(after.keywordGaps, []);
});

test('gapAnalysisNode in-graph recompute matches the route-level normalizeSkills(bullets.flatMap(b => b.skills)) computation', () => {
  const rawBullets = [
    { skills: ['Node.js', 'Express.js'] },
    { skills: ['Git', 'node']  },
  ];
  const resumeBullets = rawBullets.map((bullet, index) => ({
    bulletId: String(index),
    canonicalSkills: normalizeSkills(bullet.skills),
  }));

  const routeLevel = normalizeSkills(rawBullets.flatMap((bullet) => bullet.skills));
  const { resumeCanonicalSkills } = gapAnalysisNode({ jdCanonicalSkills: [], resumeBullets });

  assert.deepEqual(new Set(resumeCanonicalSkills), new Set(routeLevel));
});

test('gapAnalysisNode handles missing/empty resumeBullets without throwing', () => {
  const result = gapAnalysisNode({ jdCanonicalSkills: ['docker'], resumeBullets: undefined });
  assert.deepEqual(result.resumeCanonicalSkills, []);
  assert.deepEqual(result.keywordGaps, ['docker']);
});

test('mergeHumanEditedBullets preserves a human edit whose sourceBulletId is still selected, and drops one that is no longer selected', () => {
  const previousBullets = [
    { bulletId: 'old-1', sourceBulletId: 'src-1', finalText: 'human edited text', editSource: 'human' },
    { bulletId: 'old-2', sourceBulletId: 'src-2', finalText: 'ai text (unedited)', editSource: 'ai' },
    { bulletId: 'old-3', sourceBulletId: 'src-3', finalText: 'human edited but dropped this round', editSource: 'human' },
  ];
  const freshBullets = [
    { bulletId: 'new-1', sourceBulletId: 'src-1', finalText: 'freshly regenerated text', editSource: 'ai' },
    { bulletId: 'new-2', sourceBulletId: 'src-2', finalText: 'freshly regenerated text 2', editSource: 'ai' },
  ];

  const merged = mergeHumanEditedBullets(freshBullets, previousBullets);

  assert.equal(merged.length, 2);
  assert.deepEqual(merged[0], previousBullets[0]);
  assert.equal(merged[1], freshBullets[1]);
});

test('mergeHumanEditedBullets is a no-op on the first pass (no previous bullets)', () => {
  const freshBullets = [{ bulletId: 'new-1', sourceBulletId: 'src-1', finalText: 'text', editSource: 'ai' }];
  assert.deepEqual(mergeHumanEditedBullets(freshBullets, undefined), freshBullets);
});

test('ensureRequiredBulletIncluded appends the required bullet verbatim when missing', () => {
  const bullets = [{ bulletId: 'b1', sourceBulletId: 'src-1', finalText: 'existing' }];
  const resumeBulletsById = new Map([
    ['src-2', { bulletId: 'src-2', text: 'Used Git for version control across team projects.' }],
  ]);

  const result = ensureRequiredBulletIncluded(bullets, 'src-2', resumeBulletsById);

  assert.equal(result.length, 2);
  const added = result[1];
  assert.equal(added.sourceBulletId, 'src-2');
  assert.equal(added.generatedText, 'Used Git for version control across team projects.');
  assert.equal(added.finalText, 'Used Git for version control across team projects.');
  assert.equal(added.humanEditedText, null);
  assert.equal(added.editSource, 'ai');
});

test('ensureRequiredBulletIncluded no-ops when already present or requiredBulletId is null', () => {
  const bullets = [{ bulletId: 'b1', sourceBulletId: 'src-1', finalText: 'existing' }];
  const resumeBulletsById = new Map([['src-1', { bulletId: 'src-1', text: 'existing' }]]);

  assert.deepEqual(ensureRequiredBulletIncluded(bullets, 'src-1', resumeBulletsById), bullets);
  assert.deepEqual(ensureRequiredBulletIncluded(bullets, null, resumeBulletsById), bullets);
});

test('ensureEveryEmployerRepresented adds one bullet per unrepresented company, picking the highest JD-overlap candidate', () => {
  const resumeBullets = [
    { bulletId: 'a1', company: 'Acme', canonicalSkills: ['react'] },
    { bulletId: 'g1', company: 'Geekybugs', canonicalSkills: ['node.js'], text: 'g1 text' },
    { bulletId: 'g2', company: 'Geekybugs', canonicalSkills: ['node.js', 'docker'], text: 'g2 text (better match)' },
    { bulletId: 'r1', company: 'Root Pointers', canonicalSkills: [], text: 'r1 text' },
    { bulletId: 'o1', company: undefined, canonicalSkills: ['git'], text: 'orphan, no company' },
  ];
  const bullets = [{ bulletId: 'b1', sourceBulletId: 'a1', finalText: 'selected acme bullet' }];
  const jdCanonicalSkills = ['docker', 'node.js'];

  const result = ensureEveryEmployerRepresented(bullets, resumeBullets, jdCanonicalSkills);

  assert.equal(result.length, 3);
  const bySource = new Map(result.map((b) => [b.sourceBulletId, b]));
  assert.ok(bySource.has('a1'));
  assert.ok(bySource.has('g2'), 'should pick g2 over g1 for higher JD-skill overlap');
  assert.ok(!bySource.has('g1'));
  assert.ok(bySource.has('r1'));
  assert.ok(!bySource.has('o1'), 'orphan bullets with no company are never force-included');
});
