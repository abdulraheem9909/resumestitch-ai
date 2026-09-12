import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mergeAliasEntries,
  ensureAllTermsCovered,
  filterNewSkillTerms,
  buildSkillMatchers,
  findUnconfirmedLiteralSkillMatches,
} from './skillAliasesStore.js';

test('mergeAliasEntries adds every alias from a genuinely new group', () => {
  const current = { react: 'react' };
  const { mergedDict, addedEntries } = mergeAliasEntries(current, [
    { canonicalId: 'flutter', aliases: ['Flutter', 'Flutter SDK'] },
  ]);
  assert.equal(mergedDict.flutter, 'flutter');
  assert.equal(mergedDict['flutter sdk'], 'flutter');
  assert.deepEqual(addedEntries, [
    ['flutter', 'flutter'],
    ['flutter sdk', 'flutter'],
  ]);
});

test('mergeAliasEntries never overwrites an existing alias that already points elsewhere', () => {
  const current = { react: 'react' };
  const { mergedDict, addedEntries } = mergeAliasEntries(current, [
    { canonicalId: 'react-native', aliases: ['react', 'react native'] },
  ]);
  // "react" must stay pointing at "react", not get redefined to "react-native".
  assert.equal(mergedDict.react, 'react');
  // The rest of the same group's genuinely-new alias still merges.
  assert.equal(mergedDict['react native'], 'react-native');
  assert.deepEqual(addedEntries, [['react native', 'react-native']]);
});

test('mergeAliasEntries treats a canonicalId that already exists as another key\'s value as fine — just adds more aliases for it', () => {
  const current = { 'node.js': 'node.js', node: 'node.js' };
  const { mergedDict, addedEntries } = mergeAliasEntries(current, [
    { canonicalId: 'node.js', aliases: ['server-side javascript'] },
  ]);
  assert.equal(mergedDict['server-side javascript'], 'node.js');
  assert.deepEqual(addedEntries, [['server-side javascript', 'node.js']]);
});

test('mergeAliasEntries is case-insensitive and skips an alias already known under the same canonical id', () => {
  const current = { flutter: 'flutter' };
  const { mergedDict, addedEntries } = mergeAliasEntries(current, [
    { canonicalId: 'Flutter', aliases: ['FLUTTER', 'Dart'] },
  ]);
  assert.equal(mergedDict.dart, 'flutter');
  assert.deepEqual(addedEntries, [['dart', 'flutter']]);
});

test('mergeAliasEntries handles empty/missing input without throwing', () => {
  assert.deepEqual(mergeAliasEntries({ react: 'react' }, []), { mergedDict: { react: 'react' }, addedEntries: [] });
  assert.deepEqual(mergeAliasEntries({}, undefined), { mergedDict: {}, addedEntries: [] });
});

test('mergeAliasEntries ignores a group with a blank canonicalId or blank aliases', () => {
  const { mergedDict, addedEntries } = mergeAliasEntries({}, [
    { canonicalId: '  ', aliases: ['x'] },
    { canonicalId: 'y', aliases: ['', '  '] },
  ]);
  assert.deepEqual(mergedDict, {});
  assert.deepEqual(addedEntries, []);
});

test('mergeAliasEntries redirects a proposed canonicalId that is itself an existing alias, instead of creating a second competing canonical id for the same concept', () => {
  // "node" already means "node.js" in the dictionary — a group proposing
  // "node" as its OWN canonicalId must not create a rival "node" canonical
  // space; its aliases should resolve to the real canonical id, "node.js".
  const current = { node: 'node.js', 'node.js': 'node.js' };
  const { mergedDict, addedEntries } = mergeAliasEntries(current, [
    { canonicalId: 'node', aliases: ['server-side javascript runtime'] },
  ]);
  assert.equal(mergedDict['server-side javascript runtime'], 'node.js');
  assert.deepEqual(addedEntries, [['server-side javascript runtime', 'node.js']]);
});

test('ensureAllTermsCovered self-maps a term the model silently dropped from every group, despite being told every input term must land in one', () => {
  // Reproduces a real bug: proposeSkillAliasGroups was given "langgraph" and
  // "langchain" as new terms, correctly grouped "langchain" but silently
  // omitted "langgraph" entirely from its response groups — so mergeAliasEntries
  // never saw it at all, and it never became a matcher, leaving a resume
  // bullet that genuinely says "LangGraph" unable to verify the "LangGraph"
  // skill badge.
  const afterGroups = { langchain: 'langchain', 'langchain.js': 'langchain' };
  const { mergedDict, addedEntries } = ensureAllTermsCovered(afterGroups, ['langgraph', 'langchain']);
  assert.equal(mergedDict.langgraph, 'langgraph');
  // "langchain" was already covered by the model's own grouping — not touched.
  assert.equal(mergedDict.langchain, 'langchain');
  assert.deepEqual(addedEntries, [['langgraph', 'langgraph']]);
});

test('ensureAllTermsCovered is a no-op when every term is already covered', () => {
  const current = { react: 'react' };
  const { mergedDict, addedEntries } = ensureAllTermsCovered(current, ['React']);
  assert.deepEqual(mergedDict, current);
  assert.deepEqual(addedEntries, []);
});

test('ensureAllTermsCovered handles empty/missing input without throwing', () => {
  assert.deepEqual(ensureAllTermsCovered({ react: 'react' }, []), { mergedDict: { react: 'react' }, addedEntries: [] });
  assert.deepEqual(ensureAllTermsCovered({}, undefined), { mergedDict: {}, addedEntries: [] });
});

test('mergeAliasEntries applies the same canonicalId redirect across two groups in the same batch, not just against pre-existing entries', () => {
  const { mergedDict, addedEntries } = mergeAliasEntries({}, [
    { canonicalId: 'flutter', aliases: ['flutter', 'flutter sdk'] },
    // A second group in the SAME batch proposes "flutter sdk" as its own
    // canonicalId — but that string was just claimed as an alias of
    // "flutter" by the group above, so it must redirect too.
    { canonicalId: 'flutter sdk', aliases: ['dart ui toolkit'] },
  ]);
  assert.equal(mergedDict['dart ui toolkit'], 'flutter');
  assert.deepEqual(addedEntries, [
    ['flutter', 'flutter'],
    ['flutter sdk', 'flutter'],
    ['dart ui toolkit', 'flutter'],
  ]);
});

test('filterNewSkillTerms excludes a term already known as a dictionary key or as a canonical id some key points to', () => {
  const aliases = { nodejs: 'node.js', 'node.js': 'node.js' };
  const result = filterNewSkillTerms(aliases, ['NodeJS', 'node.js', 'Vercel']);
  assert.deepEqual(result, ['vercel']);
});

test('filterNewSkillTerms lowercases, trims, and dedupes candidate skills', () => {
  const result = filterNewSkillTerms({}, ['  Vercel ', 'vercel', 'VERCEL', 'Test Driven Development']);
  assert.deepEqual(result, ['vercel', 'test driven development']);
});

test('filterNewSkillTerms drops blank/whitespace-only candidates', () => {
  const result = filterNewSkillTerms({}, ['', '   ', 'Vercel']);
  assert.deepEqual(result, ['vercel']);
});

test('filterNewSkillTerms handles empty/missing input without throwing', () => {
  assert.deepEqual(filterNewSkillTerms({}, []), []);
  assert.deepEqual(filterNewSkillTerms(undefined, undefined), []);
});

// Reproduces the real "System Design" bug: the JD requires it, the resume
// bullet literally contains the words, but the dictionary never learned
// "system design" as its own term (tagBullet's LLM call extracted "System
// Architecture" from the same sentence instead) — so extractClaimedSkills
// (dictionary-only, no fallback) walks right past it. This is the narrow,
// JD-scoped literal fallback that surfaces it as "found, not yet confirmed"
// instead of leaving it silently missing.
test('findUnconfirmedLiteralSkillMatches finds a JD-required skill with no dictionary entry, literally written in the resume text', () => {
  const aliases = { 'system architecture': 'system-architecture' };
  const matchers = buildSkillMatchers(aliases);
  const result = findUnconfirmedLiteralSkillMatches(
    ['system design'],
    matchers,
    aliases,
    [],
    ['Led the system design and architecture for an executive-level SaaS planner.']
  );
  assert.deepEqual(result, ['system design']);
});

test('findUnconfirmedLiteralSkillMatches ignores a skill that already has a real dictionary matcher', () => {
  const aliases = { react: 'react', reactjs: 'react' };
  const matchers = buildSkillMatchers(aliases);
  const result = findUnconfirmedLiteralSkillMatches(['react'], matchers, aliases, [], ['Built dashboards with React.']);
  assert.deepEqual(result, []);
});

test('findUnconfirmedLiteralSkillMatches ignores a skill the user already dismissed, even though the literal text is there', () => {
  const result = findUnconfirmedLiteralSkillMatches(
    ['system design'],
    [],
    {},
    ['system design'],
    ['Led the system design and architecture for an executive-level SaaS planner.']
  );
  assert.deepEqual(result, []);
});

test('findUnconfirmedLiteralSkillMatches does not surface a skill whose literal wording never actually appears in the text', () => {
  const result = findUnconfirmedLiteralSkillMatches(['load testing'], [], {}, [], ['Led the system design for a SaaS planner.']);
  assert.deepEqual(result, []);
});

test('findUnconfirmedLiteralSkillMatches handles empty/missing input without throwing', () => {
  assert.deepEqual(findUnconfirmedLiteralSkillMatches([], [], {}, [], []), []);
  assert.deepEqual(findUnconfirmedLiteralSkillMatches(undefined, undefined, undefined, undefined, undefined), []);
});
