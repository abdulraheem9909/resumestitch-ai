import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyBullet, verifySummary } from './deterministicVerification.js';

test('verifyBullet does not flag a skill present verbatim in the source text but missing from canonicalSkills', () => {
  const sourceBullet = {
    text: 'Built SolicitorSense AI, a legal document assistant using RAG technology (Next.js, OpenAI GPT-4, Pinecone)',
    canonicalSkills: ['next.js', 'gpt-4', 'pinecone'],
  };
  const result = verifyBullet({
    generatedText: 'I built SolicitorSense AI, a legal document assistant using RAG technology, using Next.js, OpenAI GPT-4, and Pinecone.',
    sourceBullet,
  });

  assert.equal(result.passed, true);
  assert.deepEqual(result.fabricatedSkills, []);
});

test('verifyBullet still flags a skill genuinely absent from both the source text and its tags', () => {
  const sourceBullet = {
    text: 'Developed secure RESTful APIs with Node.js, increasing data security compliance scores by 30%',
    canonicalSkills: ['node.js'],
  };
  const result = verifyBullet({
    generatedText: 'I developed secure RESTful APIs with Node.js and GraphQL, increasing data security compliance scores by 30%.',
    sourceBullet,
  });

  assert.equal(result.passed, false);
  assert.deepEqual(result.fabricatedSkills, ['graphql']);
});

test('verifyBullet also picks up the RESTful APIs case from the real ConnexAI regression', () => {
  const sourceBullet = {
    text: 'Developed secure RESTful APIs with Node.js, increasing data security compliance scores by 30%',
    canonicalSkills: ['node.js'],
  };
  const result = verifyBullet({
    generatedText: 'I developed secure RESTful APIs with Node.js, increasing data security compliance scores by 30%.',
    sourceBullet,
  });

  assert.equal(result.passed, true);
  assert.deepEqual(result.fabricatedSkills, []);
});

test('verifySummary does not flag a skill present in a selected bullet\'s raw text but absent from its tags', () => {
  const selectedBullets = [
    { text: 'Built SolicitorSense AI using RAG technology.', canonicalSkills: [] },
  ];
  const result = verifySummary({
    generatedText: 'I built a legal assistant using RAG technology.',
    matchedSkills: [],
    selectedBullets,
    yearsOfExperience: 5,
  });

  assert.equal(result.passed, true);
  assert.deepEqual(result.fabricatedSkills, []);
});

test('verifySummary still flags a skill absent from matchedSkills and every selected bullet\'s text/tags', () => {
  const selectedBullets = [{ text: 'Built a web app with React.', canonicalSkills: ['react'] }];
  const result = verifySummary({
    generatedText: 'I built applications with React and MongoDB.',
    matchedSkills: [],
    selectedBullets,
    yearsOfExperience: 5,
  });

  assert.equal(result.passed, false);
  assert.deepEqual(result.fabricatedSkills, ['mongodb']);
});
