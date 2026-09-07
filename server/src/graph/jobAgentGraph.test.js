import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  computeGapAnalysis,
  mergeHumanEditedBullets,
  ensureRequiredBulletIncluded,
  ensureEveryEmployerRepresented,
  mergeHumanEditedTitle,
  preserveMatchedSkillWording,
} from './jobAgentGraph.js';
import { normalizeSkills as normalizeSkillsWithAliases } from '../services/normalizeSkills.js';
import { buildSkillMatchers } from '../services/skillAliasesStore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const skillAliases = JSON.parse(readFileSync(path.join(__dirname, '../services/__fixtures__/skillAliases.json'), 'utf-8'));
const matchers = buildSkillMatchers(skillAliases);
const normalizeSkills = (skills) => normalizeSkillsWithAliases(skills, skillAliases);

test('computeGapAnalysis recomputes resumeCanonicalSkills from current resumeBullets and shrinks keywordGaps when a missing skill is added', () => {
  const jdCanonicalSkills = ['node.js', 'express', 'git'];
  const resumeBullets = [
    { bulletId: '1', canonicalSkills: ['node.js', 'react'] },
  ];

  const before = computeGapAnalysis({ jdCanonicalSkills, resumeBullets }, skillAliases);
  assert.deepEqual(before.resumeCanonicalSkills, ['node.js', 'react']);
  assert.deepEqual(before.keywordGaps, ['express', 'git']);

  const resumeBulletsWithNewBullet = [
    ...resumeBullets,
    { bulletId: '2', canonicalSkills: ['express', 'git'] },
  ];

  const after = computeGapAnalysis({ jdCanonicalSkills, resumeBullets: resumeBulletsWithNewBullet }, skillAliases);
  assert.deepEqual(new Set(after.resumeCanonicalSkills), new Set(['node.js', 'react', 'express', 'git']));
  assert.deepEqual(after.keywordGaps, []);
});

test('computeGapAnalysis in-graph recompute matches the route-level normalizeSkills(bullets.flatMap(b => b.skills)) computation', () => {
  const rawBullets = [
    { skills: ['Node.js', 'Express.js'] },
    { skills: ['Git', 'node']  },
  ];
  const resumeBullets = rawBullets.map((bullet, index) => ({
    bulletId: String(index),
    canonicalSkills: normalizeSkills(bullet.skills),
  }));

  const routeLevel = normalizeSkills(rawBullets.flatMap((bullet) => bullet.skills));
  const { resumeCanonicalSkills } = computeGapAnalysis({ jdCanonicalSkills: [], resumeBullets }, skillAliases);

  assert.deepEqual(new Set(resumeCanonicalSkills), new Set(routeLevel));
});

test('computeGapAnalysis folds projectCanonicalSkills into resumeCanonicalSkills and shrinks keywordGaps accordingly', () => {
  const jdCanonicalSkills = ['react', 'rag', 'kubernetes'];
  const resumeBullets = [{ bulletId: '1', canonicalSkills: ['react'] }];
  const projectCanonicalSkills = ['rag', 'pinecone'];

  const withoutProjects = computeGapAnalysis({ jdCanonicalSkills, resumeBullets }, skillAliases);
  assert.deepEqual(withoutProjects.keywordGaps, ['rag', 'kubernetes']);

  const withProjects = computeGapAnalysis({ jdCanonicalSkills, resumeBullets, projectCanonicalSkills }, skillAliases);
  assert.deepEqual(new Set(withProjects.resumeCanonicalSkills), new Set(['react', 'rag', 'pinecone']));
  assert.deepEqual(withProjects.keywordGaps, ['kubernetes']);
});

test('computeGapAnalysis re-resolves a stale, un-canonicalized resume skill against the current alias dictionary instead of trusting it verbatim', () => {
  // Simulates the real bug: a bullet's canonicalSkills was frozen at upload
  // time as raw text ("aws ec2") rather than the true canonical id ("ec2"),
  // e.g. because the alias-learning step ran moments too late to affect it.
  // A JD requirement that's already correctly canonicalized to "ec2" must
  // still be recognized as a match, not a false gap, once this runs back
  // through the current dictionary.
  const jdCanonicalSkills = ['ec2', 'react'];
  const resumeBullets = [{ bulletId: '1', canonicalSkills: ['aws ec2', 'react'] }];

  const result = computeGapAnalysis({ jdCanonicalSkills, resumeBullets }, skillAliases);
  assert.deepEqual(result.resumeCanonicalSkills, ['ec2', 'react']);
  assert.deepEqual(result.keywordGaps, []);
});

test('computeGapAnalysis handles missing/empty resumeBullets without throwing', () => {
  const result = computeGapAnalysis({ jdCanonicalSkills: ['docker'], resumeBullets: undefined }, skillAliases);
  assert.deepEqual(result.resumeCanonicalSkills, []);
  assert.deepEqual(result.keywordGaps, ['docker']);
});

test('mergeHumanEditedBullets preserves a human edit whose sourceBulletId is still present, and drops one that is no longer present', () => {
  const previousBullets = [
    { bulletId: 'old-1', sourceBulletId: 'src-1', finalText: 'human edited text', editSource: 'human', rejected: false },
    { bulletId: 'old-2', sourceBulletId: 'src-2', finalText: 'ai text (unedited)', editSource: 'ai', rejected: false },
    { bulletId: 'old-3', sourceBulletId: 'src-3', finalText: 'human edited but dropped this round', editSource: 'human', rejected: false },
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

test('mergeHumanEditedBullets preserves a human-edited bullet\'s own rejected state across a retry, instead of forcing it back to included', () => {
  const previousBullets = [
    { bulletId: 'old-1', sourceBulletId: 'src-1', finalText: 'human edited text', editSource: 'human', rejected: false },
  ];
  const freshBullets = [
    { bulletId: 'new-1', sourceBulletId: 'src-1', finalText: 'source text', editSource: 'ai', rejected: true },
  ];

  const merged = mergeHumanEditedBullets(freshBullets, previousBullets);

  assert.equal(merged.length, 1);
  assert.equal(merged[0].rejected, false);
  assert.equal(merged[0].finalText, 'human edited text');
});

test('mergeHumanEditedBullets preserves a manual exclude (rejectionSource: human) even when the fresh AI pass would include it', () => {
  const previousBullets = [
    {
      bulletId: 'old-1',
      sourceBulletId: 'src-1',
      finalText: 'human edited text',
      editSource: 'human',
      rejected: true,
      rejectionSource: 'human',
    },
  ];
  const freshBullets = [
    { bulletId: 'new-1', sourceBulletId: 'src-1', finalText: 'source text', editSource: 'ai', rejected: false },
  ];

  const merged = mergeHumanEditedBullets(freshBullets, previousBullets);

  assert.equal(merged.length, 1);
  assert.equal(merged[0].rejected, true, 'a manual exclude must survive the retry');
  assert.equal(merged[0].finalText, 'human edited text');
});

test('mergeHumanEditedBullets also carries forward a manual include/exclude toggle on a bullet whose text was never hand-edited', () => {
  const previousBullets = [
    {
      bulletId: 'old-1',
      sourceBulletId: 'src-1',
      finalText: 'ai text, never edited',
      editSource: 'ai',
      rejected: true,
      rejectionSource: 'human',
    },
  ];
  const freshBullets = [
    { bulletId: 'new-1', sourceBulletId: 'src-1', finalText: 'freshly regenerated text', editSource: 'ai', rejected: false },
  ];

  const merged = mergeHumanEditedBullets(freshBullets, previousBullets);

  assert.equal(merged.length, 1);
  assert.equal(merged[0].rejected, true);
  assert.equal(merged[0].finalText, 'ai text, never edited', 'carries the whole previous entry forward, not just the rejected flag');
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
  assert.equal(added.rejected, false);
});

test('ensureRequiredBulletIncluded no-ops when already present and not rejected, or requiredBulletId is null', () => {
  const bullets = [{ bulletId: 'b1', sourceBulletId: 'src-1', finalText: 'existing', rejected: false }];
  const resumeBulletsById = new Map([['src-1', { bulletId: 'src-1', text: 'existing' }]]);

  assert.deepEqual(ensureRequiredBulletIncluded(bullets, 'src-1', resumeBulletsById), bullets);
  assert.deepEqual(ensureRequiredBulletIncluded(bullets, null, resumeBulletsById), bullets);
});

test('ensureRequiredBulletIncluded un-rejects an existing-but-rejected entry in place', () => {
  const bullets = [
    { bulletId: 'b0', sourceBulletId: 'src-0', finalText: 'other bullet', rejected: false },
    { bulletId: 'b1', sourceBulletId: 'src-1', finalText: 'src-1 text', editSource: 'ai', rejected: true },
  ];
  const resumeBulletsById = new Map([['src-1', { bulletId: 'src-1', text: 'Used Git for version control.' }]]);

  const result = ensureRequiredBulletIncluded(bullets, 'src-1', resumeBulletsById);

  assert.equal(result.length, 2);
  assert.equal(result[0], bullets[0]);
  assert.equal(result[1].sourceBulletId, 'src-1');
  assert.equal(result[1].rejected, false);
  assert.equal(result[1].finalText, 'Used Git for version control.');
});

test('ensureRequiredBulletIncluded does not override a human\'s manual exclude, even for the exact bullet this retry was meant to guarantee', () => {
  const bullets = [
    {
      bulletId: 'b1',
      sourceBulletId: 'src-1',
      finalText: 'src-1 text, manually excluded',
      editSource: 'human',
      rejected: true,
      rejectionSource: 'human',
    },
  ];
  const resumeBulletsById = new Map([['src-1', { bulletId: 'src-1', text: 'Used Git for version control.' }]]);

  const result = ensureRequiredBulletIncluded(bullets, 'src-1', resumeBulletsById);

  assert.equal(result, bullets, 'no-op — the human exclude wins even over the required-bullet guarantee');
});

test('ensureEveryEmployerRepresented adds one bullet per unrepresented company, picking the highest JD-overlap candidate', () => {
  const resumeBullets = [
    { bulletId: 'a1', company: 'Acme', canonicalSkills: ['react'] },
    { bulletId: 'g1', company: 'Geekybugs', canonicalSkills: ['node.js'], text: 'g1 text' },
    { bulletId: 'g2', company: 'Geekybugs', canonicalSkills: ['node.js', 'docker'], text: 'g2 text (better match)' },
    { bulletId: 'r1', company: 'Root Pointers', canonicalSkills: [], text: 'r1 text' },
    { bulletId: 'o1', company: undefined, canonicalSkills: ['git'], text: 'orphan, no company' },
  ];
  const bullets = [{ bulletId: 'b1', sourceBulletId: 'a1', finalText: 'selected acme bullet', rejected: false }];
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

test('ensureEveryEmployerRepresented un-rejects the best existing entry for an employer whose bullets are all currently rejected, instead of appending a duplicate', () => {
  const resumeBullets = [
    { bulletId: 'a1', company: 'Acme', canonicalSkills: ['react'], text: 'a1 text' },
    { bulletId: 'g1', company: 'Geekybugs', canonicalSkills: ['node.js'], text: 'g1 text' },
    { bulletId: 'g2', company: 'Geekybugs', canonicalSkills: ['node.js', 'docker'], text: 'g2 text (better match)' },
  ];
  const bullets = [
    { bulletId: 'b1', sourceBulletId: 'a1', finalText: 'selected acme bullet', rejected: false },
    { bulletId: 'b2', sourceBulletId: 'g1', finalText: 'g1 tailored', rejected: true },
    { bulletId: 'b3', sourceBulletId: 'g2', finalText: 'g2 tailored', rejected: true },
  ];
  const jdCanonicalSkills = ['docker', 'node.js'];

  const result = ensureEveryEmployerRepresented(bullets, resumeBullets, jdCanonicalSkills);

  assert.equal(result.length, 3, 'no duplicate bullet should be appended');
  const bySource = new Map(result.map((b) => [b.sourceBulletId, b]));
  assert.equal(bySource.get('a1').rejected, false);
  assert.equal(bySource.get('g1').rejected, true, 'g1 stays rejected — g2 is the better-overlap pick');
  assert.equal(bySource.get('g2').rejected, false, 'g2 is un-rejected in place for Geekybugs');
});

test('ensureEveryEmployerRepresented leaves an employer unrepresented if every one of its bullets was manually excluded by the human', () => {
  const resumeBullets = [
    { bulletId: 'a1', company: 'Acme', canonicalSkills: ['react'], text: 'a1 text' },
    { bulletId: 'g1', company: 'Geekybugs', canonicalSkills: ['node.js'], text: 'g1 text' },
  ];
  const bullets = [
    { bulletId: 'b1', sourceBulletId: 'a1', finalText: 'selected acme bullet', rejected: false },
    { bulletId: 'b2', sourceBulletId: 'g1', finalText: 'g1 tailored, manually excluded', rejected: true, rejectionSource: 'human' },
  ];
  const jdCanonicalSkills = ['node.js'];

  const result = ensureEveryEmployerRepresented(bullets, resumeBullets, jdCanonicalSkills);

  assert.equal(result.length, 2, 'no bullet force-added for Geekybugs — its only bullet was manually excluded');
  const bySource = new Map(result.map((b) => [b.sourceBulletId, b]));
  assert.equal(bySource.get('g1').rejected, true);
});

test('mergeHumanEditedTitle preserves a hand-edited title across a retry instead of the fresh suggestion', () => {
  const freshTitle = { generatedText: 'Full-Stack Engineer', humanEditedText: null, finalText: 'Full-Stack Engineer', editSource: 'ai' };
  const previousTitle = { generatedText: 'Backend Engineer', humanEditedText: 'Platform Engineer', finalText: 'Platform Engineer', editSource: 'human' };

  assert.deepEqual(mergeHumanEditedTitle(freshTitle, previousTitle), previousTitle);
});

test('mergeHumanEditedTitle uses the fresh suggestion when the previous title was never hand-edited', () => {
  const freshTitle = { generatedText: 'Full-Stack Engineer', humanEditedText: null, finalText: 'Full-Stack Engineer', editSource: 'ai' };
  const previousTitle = { generatedText: 'Backend Engineer', humanEditedText: null, finalText: 'Backend Engineer', editSource: 'ai' };

  assert.deepEqual(mergeHumanEditedTitle(freshTitle, previousTitle), freshTitle);
});

test('mergeHumanEditedTitle uses the fresh suggestion on the first pass (no previous title)', () => {
  const freshTitle = { generatedText: 'Full-Stack Engineer', humanEditedText: null, finalText: 'Full-Stack Engineer', editSource: 'ai' };

  assert.deepEqual(mergeHumanEditedTitle(freshTitle, undefined), freshTitle);
});

test('preserveMatchedSkillWording reverts a kept bullet whose rephrase dropped a matched skill literally present in the source', () => {
  const resumeBulletsById = new Map([
    [
      'src-1',
      { bulletId: 'src-1', text: 'Architected a system on MERN stack (MongoDB, Express.js, React, Node.js) deployed on AWS EC2.' },
    ],
  ]);
  const bullets = [
    {
      bulletId: 'b1',
      sourceBulletId: 'src-1',
      finalText: 'Architected a system on the MERN stack, deployed on AWS EC2.',
      rejected: false,
      editSource: 'ai',
    },
  ];

  const result = preserveMatchedSkillWording(bullets, resumeBulletsById, ['express'], matchers, skillAliases);

  assert.equal(result[0].finalText, resumeBulletsById.get('src-1').text);
  assert.equal(result[0].rephraseIntensity, 0);
});

test('preserveMatchedSkillWording leaves a kept bullet untouched when the tailored text still contains the matched skill', () => {
  const resumeBulletsById = new Map([
    ['src-1', { bulletId: 'src-1', text: 'Built APIs with Express.js and Node.js.' }],
  ]);
  const bullets = [
    { bulletId: 'b1', sourceBulletId: 'src-1', finalText: 'Built secure APIs using Express.js and Node.js.', rejected: false, editSource: 'ai' },
  ];

  const result = preserveMatchedSkillWording(bullets, resumeBulletsById, ['express'], matchers, skillAliases);

  assert.deepEqual(result, bullets);
});

test('preserveMatchedSkillWording leaves a kept bullet untouched when the dropped skill is not in matchedSkills', () => {
  const resumeBulletsById = new Map([
    ['src-1', { bulletId: 'src-1', text: 'Built APIs with Express.js and Redis for caching.' }],
  ]);
  const bullets = [
    { bulletId: 'b1', sourceBulletId: 'src-1', finalText: 'Built APIs with Express.js for improved performance.', rejected: false, editSource: 'ai' },
  ];

  // "redis" was dropped, but it's not a JD-matched skill this time — "express"
  // (the only matched skill) is still present in the tailored text.
  const result = preserveMatchedSkillWording(bullets, resumeBulletsById, ['express'], matchers, skillAliases);

  assert.deepEqual(result, bullets);
});

test('preserveMatchedSkillWording never touches a hand-edited bullet, even if it also drops a matched skill', () => {
  const resumeBulletsById = new Map([
    ['src-1', { bulletId: 'src-1', text: 'Built APIs with Express.js and Node.js.' }],
  ]);
  const bullets = [
    { bulletId: 'b1', sourceBulletId: 'src-1', finalText: 'Built APIs with Node.js.', rejected: false, editSource: 'human' },
  ];

  const result = preserveMatchedSkillWording(bullets, resumeBulletsById, ['express'], matchers, skillAliases);

  assert.deepEqual(result, bullets);
});

test('preserveMatchedSkillWording no-ops on an already-rejected bullet', () => {
  const resumeBulletsById = new Map([
    ['src-1', { bulletId: 'src-1', text: 'Built APIs with Express.js and Node.js.' }],
  ]);
  const bullets = [
    { bulletId: 'b1', sourceBulletId: 'src-1', finalText: 'Built APIs with Node.js.', rejected: true, editSource: 'ai' },
  ];

  const result = preserveMatchedSkillWording(bullets, resumeBulletsById, ['express'], matchers, skillAliases);

  assert.deepEqual(result, bullets);
});
