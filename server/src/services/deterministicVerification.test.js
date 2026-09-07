import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { verifyBullet, verifySummary, trustHumanEdit } from './deterministicVerification.js';
import { buildSkillMatchers } from './skillAliasesStore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const skillAliases = JSON.parse(readFileSync(path.join(__dirname, '__fixtures__/skillAliases.json'), 'utf-8'));
const matchers = buildSkillMatchers(skillAliases);

test('trustHumanEdit always passes and never reports a fabricated skill or metric, regardless of what the text claims', () => {
  const result = trustHumanEdit('Used Express.js and Git for version control, cutting deploy time by 99%.', matchers, skillAliases);

  assert.equal(result.passed, true);
  assert.deepEqual(result.fabricatedSkills, []);
  assert.deepEqual(result.fabricatedMetrics, []);
});

test('trustHumanEdit still reports what the text actually claims, so callers can credit those skills elsewhere', () => {
  const result = trustHumanEdit('Used Express.js and Git for version control.', matchers, skillAliases);

  assert.ok(result.claimedSkills.includes('express'));
  assert.ok(result.claimedSkills.includes('git'));
});

test('trustHumanEdit handles empty/missing text without throwing', () => {
  assert.deepEqual(trustHumanEdit('', matchers, skillAliases).claimedSkills, []);
  assert.deepEqual(trustHumanEdit(undefined, matchers, skillAliases).claimedSkills, []);
});

test('trustHumanEdit recognizes docker, linux, api/apis, and websocket/websockets', () => {
  const result = trustHumanEdit(
    'Containerized the deployment pipeline with Docker on Linux, exposed via a REST API with WebSocket support.',
    matchers,
    skillAliases
  );

  assert.ok(result.claimedSkills.includes('docker'));
  assert.ok(result.claimedSkills.includes('linux'));
  assert.ok(result.claimedSkills.includes('rest-api'));
  assert.ok(result.claimedSkills.includes('websocket'));
});

test('trustHumanEdit recognizes bare "API"/"APIs" (not just "REST API")', () => {
  assert.ok(trustHumanEdit('Integrated third-party APIs for small business clients.', matchers, skillAliases).claimedSkills.includes('api'));
  assert.ok(trustHumanEdit('Built and consumed a public API.', matchers, skillAliases).claimedSkills.includes('api'));
});

test('verifyBullet does not flag a skill present verbatim in the source text but missing from canonicalSkills', () => {
  const sourceBullet = {
    text: 'Built SolicitorSense AI, a legal document assistant using RAG technology (Next.js, OpenAI GPT-4, Pinecone)',
    canonicalSkills: ['next.js', 'gpt-4', 'pinecone'],
  };
  const result = verifyBullet(
    {
      generatedText: 'I built SolicitorSense AI, a legal document assistant using RAG technology, using Next.js, OpenAI GPT-4, and Pinecone.',
      sourceBullet,
    },
    matchers,
    skillAliases
  );

  assert.equal(result.passed, true);
  assert.deepEqual(result.fabricatedSkills, []);
});

test('verifyBullet still flags a skill genuinely absent from both the source text and its tags', () => {
  const sourceBullet = {
    text: 'Developed secure RESTful APIs with Node.js, increasing data security compliance scores by 30%',
    canonicalSkills: ['node.js'],
  };
  const result = verifyBullet(
    {
      generatedText: 'I developed secure RESTful APIs with Node.js and GraphQL, increasing data security compliance scores by 30%.',
      sourceBullet,
    },
    matchers,
    skillAliases
  );

  assert.equal(result.passed, false);
  assert.deepEqual(result.fabricatedSkills, ['graphql']);
});

test('verifyBullet also picks up the RESTful APIs case from the real ConnexAI regression', () => {
  const sourceBullet = {
    text: 'Developed secure RESTful APIs with Node.js, increasing data security compliance scores by 30%',
    canonicalSkills: ['node.js'],
  };
  const result = verifyBullet(
    {
      generatedText: 'I developed secure RESTful APIs with Node.js, increasing data security compliance scores by 30%.',
      sourceBullet,
    },
    matchers,
    skillAliases
  );

  assert.equal(result.passed, true);
  assert.deepEqual(result.fabricatedSkills, []);
});

test('verifySummary does not flag a skill present in a selected bullet\'s raw text but absent from its tags', () => {
  const selectedBullets = [
    { text: 'Built SolicitorSense AI using RAG technology.', canonicalSkills: [] },
  ];
  const result = verifySummary(
    {
      generatedText: 'I built a legal assistant using RAG technology.',
      matchedSkills: [],
      selectedBullets,
      yearsOfExperience: 5,
    },
    matchers,
    skillAliases
  );

  assert.equal(result.passed, true);
  assert.deepEqual(result.fabricatedSkills, []);
});

test('verifySummary still flags a skill absent from matchedSkills and every selected bullet\'s text/tags', () => {
  const selectedBullets = [{ text: 'Built a web app with React.', canonicalSkills: ['react'] }];
  const result = verifySummary(
    {
      generatedText: 'I built applications with React and MongoDB.',
      matchedSkills: [],
      selectedBullets,
      yearsOfExperience: 5,
    },
    matchers,
    skillAliases
  );

  assert.equal(result.passed, false);
  assert.deepEqual(result.fabricatedSkills, ['mongodb']);
});

// Regression: the skill-alias dictionary was extended (see skillAliasesStore.js)
// to recognize job-title/soft-skill phrasing for the display badge — e.g.
// "Full Stack Engineer", "Mentored", "conducted code reviews". Those ids can
// never appear in an "allowed" set built from tagBullet.js/extractJdKeywords.js's
// vocabulary, since that vocabulary deliberately never tags them as skills in
// the first place — so recognizing them as a *claim* here made them
// permanently unprovable, producing a false fabrication accusation for
// something completely benign. A real live application's tailored summary
// ("...as a Full Stack Engineer...") reproduced this exactly.
test('verifySummary never flags a job-title/soft-skill phrase as a fabricated claim, even though the badge recognizes it', () => {
  const result = verifySummary(
    {
      generatedText: 'With extensive experience as a Full Stack Engineer, I mentored junior developers and conducted code reviews.',
      matchedSkills: ['react'],
      selectedBullets: [{ text: 'Built applications with React.', canonicalSkills: ['react'] }],
      yearsOfExperience: 5,
    },
    matchers,
    skillAliases
  );

  assert.equal(result.passed, true);
  assert.deepEqual(result.fabricatedSkills, []);
});

// Regression: node 5's summary is required to phrase years of experience as
// "5+ years" (see tailorContent.js's SUMMARY_RULES), but the numeric
// allowlist only ever contained the plain "5"/"6" forms, not "5+" — so the
// mandated, correct phrasing was extracted as its own token and flagged as a
// fabricated metric. A real application ("Durlston") reproduced this exactly:
// a summary that correctly said "5+ years" was flagged unsupportedClaim.
// Deliberately no bullet here contains the literal substring "5+", so this
// only passes because the fix explicitly allows the floored "+" form — not
// by the same coincidence that let a second real application ("Diligent")
// pass only because an unrelated bullet happened to also contain "5+".
test('verifySummary does not flag the mandated "N+ years" phrasing as a fabricated metric', () => {
  const result = verifySummary(
    {
      generatedText: 'Full Stack Engineer with 5+ years of experience building React applications.',
      matchedSkills: ['react'],
      selectedBullets: [{ text: 'Built applications with React.', canonicalSkills: ['react'] }],
      yearsOfExperience: 5,
    },
    matchers,
    skillAliases
  );

  assert.equal(result.passed, true);
  assert.deepEqual(result.fabricatedMetrics, []);
});

test('verifySummary allows "N+ years" using the FLOORED figure for a fractional yearsOfExperience, not the raw decimal or the ceiling', () => {
  const result = verifySummary(
    {
      generatedText: 'Full Stack Engineer with 5+ years of experience building React applications.',
      matchedSkills: ['react'],
      selectedBullets: [{ text: 'Built applications with React.', canonicalSkills: ['react'] }],
      yearsOfExperience: 5.7,
    },
    matchers,
    skillAliases
  );

  assert.equal(result.passed, true);
  assert.deepEqual(result.fabricatedMetrics, []);
});

test('verifySummary still flags a genuinely fabricated metric unrelated to years of experience', () => {
  const result = verifySummary(
    {
      generatedText: 'Full Stack Engineer with 5+ years of experience, increasing revenue by 50%.',
      matchedSkills: ['react'],
      selectedBullets: [{ text: 'Built applications with React.', canonicalSkills: ['react'] }],
      yearsOfExperience: 5,
    },
    matchers,
    skillAliases
  );

  assert.equal(result.passed, false);
  assert.deepEqual(result.fabricatedMetrics, ['50%']);
});

test('verifyBullet never flags a job-title/soft-skill phrase as a fabricated claim', () => {
  const sourceBullet = { text: 'Worked on the frontend and backend of the platform.', canonicalSkills: [] };
  const result = verifyBullet(
    {
      generatedText: 'Contributed to both the frontend and backend of the platform, plus general system architecture.',
      sourceBullet,
    },
    matchers,
    skillAliases
  );

  assert.equal(result.passed, true);
  assert.deepEqual(result.fabricatedSkills, []);
});

// The tripwire: excluding soft-skill/job-title ids from the fabrication check
// must never widen to cover a real technical skill by accident. A genuinely
// fabricated hard skill must still be caught exactly as before.
test('verifyBullet still catches a genuinely fabricated hard skill, unaffected by the soft-skill exclusion', () => {
  const sourceBullet = { text: 'Built a backend service with Node.js.', canonicalSkills: ['node.js'] };
  const result = verifyBullet(
    {
      generatedText: 'Built a backend service with Node.js and MongoDB.',
      sourceBullet,
    },
    matchers,
    skillAliases
  );

  assert.equal(result.passed, false);
  assert.deepEqual(result.fabricatedSkills, ['mongodb']);
});

test('trustHumanEdit still reports a genuine hard-skill claim, only soft-skill/job-title ids are excluded', () => {
  const result = trustHumanEdit('As a Full Stack Engineer, I used React and mentored junior developers.', matchers, skillAliases);

  assert.ok(result.claimedSkills.includes('react'));
  assert.ok(!result.claimedSkills.includes('full-stack-engineer'));
  assert.ok(!result.claimedSkills.includes('mentorship'));
});

// Reproduces a real bug: "unit-testing" was mistakenly added to
// NON_VERIFIABLE_CLAIM_IDS alongside genuine soft-skills/job-titles
// (mentorship, agile, full-stack-engineer, ...) even though tagBullet.js's
// own prompt never excludes it — "unit testing" is a concrete, taggable
// technical practice, not a soft skill or job title. Because
// computeHumanRecheck (applications.js) builds its live "still missing"
// list from verifyBullet's claimedSkills, excluding "unit-testing" here made
// a bullet that genuinely, verifiably says "unit testing" silently drop back
// out of that list — producing a lower "skills matched" count on the
// Approval page's Re-check pass than the original, unaffected node-3 gap
// analysis (which doesn't use this exclusion list at all) showed for the
// exact same resume content.
test('verifyBullet counts "unit testing" as a real, verifiable claim, not a soft-skill/job-title exclusion', () => {
  const sourceBullet = {
    text: 'Conducted comprehensive unit testing and quality assurance (QA), reducing bug reports post-launch.',
    canonicalSkills: ['unit testing', 'quality assurance (qa)'],
  };
  const result = verifyBullet(
    {
      generatedText: 'Conducted comprehensive unit testing and quality assurance (QA), reducing bug reports post-launch.',
      sourceBullet,
    },
    matchers,
    skillAliases
  );

  assert.ok(result.claimedSkills.includes('unit-testing'));
});
