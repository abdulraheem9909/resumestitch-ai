import SkillAliasDictionary from '../models/SkillAliasDictionary.js';
import { proposeSkillAliasGroups } from './generateSkillAliases.js';
import { canonicalizeSkill } from './canonicalizeSkill.js';

// Exported for reuse by verifiedSkills.js, which needs the same escaping to
// check a skill's own literal wording against text, separate from (and in
// addition to) the alias-based matching this module does.
export function escapeRegex(term) {
  return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Same regex construction buildSkillMatchers uses (word-boundary,
// case-insensitive, internal whitespace collapsed to \s+) — for searching a
// single term's own literal wording directly, when there's no dictionary
// entry to build a real matcher from at all. Shared by skillFrequency.js
// (falls back to this when a requested skill has no dictionary entry) and
// findUnconfirmedLiteralSkillMatches below (same situation, different
// caller) — one implementation, not two that can quietly drift apart.
export function buildLiteralMatcher(term) {
  return { term, regex: new RegExp(`\\b${escapeRegex(term).replace(/\s+/g, '\\s+')}\\b`, 'gi') };
}

// Longer terms first, so a multi-word term matches before a shorter
// substring of itself.
export function buildSkillMatchers(skillAliases) {
  const knownTerms = [...new Set([...Object.keys(skillAliases), ...Object.values(skillAliases)])].sort(
    (a, b) => b.length - a.length
  );
  return knownTerms.map((term) => ({
    term,
    regex: new RegExp(`\\b${escapeRegex(term).replace(/\s+/g, '\\s+')}\\b`, 'gi'),
  }));
}

/**
 * Pure — no I/O. Merges AI-proposed alias groups (see generateSkillAliases.js)
 * into the current dictionary. Never overwrites an established mapping: if a
 * proposed alias already exists as a key pointing to a *different* canonical
 * id, that one alias is dropped, but the rest of its group's genuinely-new
 * aliases still merge. A proposed canonicalId that already exists as some
 * other key's value is fine — it just adds more aliases for a known concept.
 */
export function mergeAliasEntries(currentDict, proposedGroups) {
  const mergedDict = { ...currentDict };
  const addedEntries = [];

  for (const group of proposedGroups || []) {
    let canonicalId = (group.canonicalId || '').trim().toLowerCase();
    if (!canonicalId) continue;

    // The model's proposed canonicalId can itself already be a *known alias*
    // of something else (e.g. proposing "node" while "node" already means
    // "node.js" in the dictionary) — redirect to the real canonical id
    // instead of creating a second, competing canonical space for the same
    // concept. mergedDict is checked (not currentDict), so this also catches
    // a collision against an alias added by an earlier group in this same
    // batch, not just a pre-existing one.
    if (mergedDict[canonicalId] !== undefined) {
      canonicalId = mergedDict[canonicalId];
    }

    for (const rawAlias of group.aliases || []) {
      const alias = (rawAlias || '').trim().toLowerCase();
      if (!alias) continue;

      const existing = mergedDict[alias];
      if (existing !== undefined && existing !== canonicalId) {
        // Already means something else — never silently redefine it.
        continue;
      }
      if (existing === canonicalId) continue; // already known, nothing to add

      mergedDict[alias] = canonicalId;
      addedEntries.push([alias, canonicalId]);
    }
  }

  return { mergedDict, addedEntries };
}

/**
 * Pure — no I/O. proposeSkillAliasGroups' own prompt tells the model "every
 * input term must end up as an alias in exactly one group," but nothing
 * verifies it actually did — found live: given ["langgraph", "langchain"],
 * the model correctly grouped "langchain" but silently dropped "langgraph"
 * from every group in its response. A term missing from the dictionary
 * entirely is invisible to buildSkillMatchers, so a resume bullet that
 * genuinely says "LangGraph" can never verify the "LangGraph" skill badge.
 * Called after mergeAliasEntries with the same `newTerms` list that was sent
 * to the model; any term still not present as a key in `mergedDict` (i.e.
 * neither self-mapped nor grouped under another term's canonical id) is
 * self-mapped to itself, the same safe, no-fabrication-risk fallback this
 * codebase already uses elsewhere (e.g. force-including a skill-gap bullet).
 */
export function ensureAllTermsCovered(mergedDict, terms) {
  const dict = { ...mergedDict };
  const addedEntries = [];

  for (const rawTerm of terms || []) {
    const term = (rawTerm || '').trim().toLowerCase();
    if (!term || dict[term] !== undefined) continue;
    dict[term] = term;
    addedEntries.push([term, term]);
  }

  return { mergedDict: dict, addedEntries };
}

/**
 * Reads this user's own dictionary fresh from Mongo — no process-wide cache,
 * since the dictionary is now per-user rather than one shared file. Returns
 * the raw alias map plus its derived matchers together, since almost every
 * caller needs both.
 */
export async function getSkillDictionaryForUser(userId) {
  const doc = await SkillAliasDictionary.findOne({ userId });
  const aliases = doc?.aliases || {};
  return { aliases, matchers: buildSkillMatchers(aliases) };
}

/**
 * Impure wrapper: merges the proposed groups into this user's own dictionary
 * and upserts it — called by the resume-upload route (resumes.js), never
 * during a per-JD run. `newTerms`, when given, is the same term list that
 * was sent to proposeSkillAliasGroups — passed through to
 * ensureAllTermsCovered so a term the model's response silently dropped
 * still ends up in the dictionary (self-mapped) rather than staying
 * permanently invisible to buildSkillMatchers. Omitted for the JD-side
 * caller (jobAgentGraph.js), whose matchUnresolvedSkillsToKnown() already
 * guarantees every non-"no match" term lands in a real group by construction
 * (a closed-choice enum, not free-form grouping), so there's nothing to
 * backfill there.
 */
export async function addSkillAliasEntriesForUser(userId, proposedGroups, newTerms) {
  const doc = await SkillAliasDictionary.findOne({ userId });
  const currentDict = doc?.aliases || {};
  const { mergedDict: afterGroups, addedEntries: fromGroups } = mergeAliasEntries(currentDict, proposedGroups);
  const { mergedDict, addedEntries: fromFallback } = ensureAllTermsCovered(afterGroups, newTerms);
  const addedEntries = [...fromGroups, ...fromFallback];
  if (addedEntries.length === 0) return addedEntries;

  await SkillAliasDictionary.findOneAndUpdate({ userId }, { aliases: mergedDict }, { upsert: true });
  return addedEntries;
}

/**
 * Pure — no I/O. Given the dictionary as it currently stands and a list of
 * raw skill terms a tagging pass just found, returns only the ones that
 * aren't already known under either spelling (a dictionary key or a
 * canonical id some key already points to) — lowercased/deduped/trimmed.
 * Extracted from what was previously inline, upload-route-only logic (see
 * growSkillDictionaryFromTerms below) so it's independently testable and
 * reusable everywhere a tagging pass produces candidate skills.
 */
export function filterNewSkillTerms(currentAliases, candidateSkills) {
  const known = new Set(
    Object.entries(currentAliases || {}).flatMap(([alias, canonicalId]) => [alias.toLowerCase(), canonicalId.toLowerCase()])
  );
  return [...new Set((candidateSkills || []).map((skill) => (skill || '').trim().toLowerCase()).filter(Boolean))].filter(
    (term) => !known.has(term)
  );
}

/**
 * Impure orchestrator — the one shared "teach the dictionary" step every
 * place that extracts skills from new text should call, not just resume
 * upload. Found live: a genuinely new skill typed anywhere else (an in-app
 * master-resume bullet edit, a hand-edited application bullet/summary, an
 * accepted skill-gap suggestion) was invisible to Re-check, the skill
 * badges, and skill frequency — not because those checks are broken, but
 * because nothing had ever taught the dictionary the word existed in the
 * first place. This composes only already-working pieces
 * (proposeSkillAliasGroups + addSkillAliasEntriesForUser, both unchanged)
 * behind one call, with its own try/catch so a growth failure (a flaky AI
 * call, a rate limit) can never block whatever save triggered it — the same
 * "never fails the parent action" guarantee step 5b already had, now
 * available to every caller instead of duplicated per call site.
 */
export async function growSkillDictionaryFromTerms(userId, currentAliases, candidateSkills) {
  const newTerms = filterNewSkillTerms(currentAliases, candidateSkills);
  if (newTerms.length === 0) return [];

  try {
    const { groups } = await proposeSkillAliasGroups(newTerms);
    return await addSkillAliasEntriesForUser(userId, groups, newTerms);
  } catch (err) {
    console.error('Skill-alias generation failed (caller unaffected):', err);
    return [];
  }
}

/**
 * Pure — no I/O. `extractClaimedSkills` (deterministicVerification.js) only
 * ever recognizes a skill that already has a dictionary entry — no fallback.
 * Found live: a JD requires "System Design," the resume bullet literally
 * contains those words, but tagBullet's LLM call tagged the same sentence as
 * "System Architecture" instead, so the dictionary never learned "system
 * design" as its own term — Skill Match/Skills Gap kept it listed as
 * missing even though it's right there in the text.
 *
 * Deliberately narrow: only checked against `candidateSkills` (the current
 * JD's own gap list), never a blind scan for arbitrary text — a generic
 * single word could otherwise false-match an unrelated sentence. For each
 * skill with no real matcher (the same "does any matcher canonicalize to
 * this skill" check skillFrequency.js already uses) and not already in
 * `dismissedSkills`, builds a literal matcher (buildLiteralMatcher, shared
 * with skillFrequency.js) and tests it against the joined `sourceTexts`.
 * Deliberately does NOT auto-teach the dictionary — a hit here is surfaced
 * to the human as "found, not yet confirmed" (see confirmSkillTerm), not
 * silently credited, matching this app's "you approve everything" principle
 * rather than letting a literal-text coincidence self-certify a claim.
 *
 * `dismissedSkills` is deliberately the CALLER's concern, not this module's —
 * it's `application.dismissedSkills` (per-application), not anything stored
 * on the shared per-user dictionary. A literal match being noise on one JD
 * says nothing about whether the same skill is a genuine, deliberate claim
 * on a different JD, so dismissing it must never leak across applications.
 */
export function findUnconfirmedLiteralSkillMatches(candidateSkills, matchers, skillAliases, dismissedSkills, sourceTexts) {
  const dismissed = new Set(dismissedSkills || []);
  const text = (sourceTexts || []).filter(Boolean).join('\n');
  if (!text) return [];

  return (candidateSkills || []).filter((skill) => {
    if (dismissed.has(skill)) return false;
    const hasRealMatcher = (matchers || []).some(({ term }) => canonicalizeSkill(term, skillAliases || {}) === skill);
    if (hasRealMatcher) return false;

    const { regex } = buildLiteralMatcher(skill);
    return regex.test(text);
  });
}

/**
 * Impure — the human-confirmed counterpart to the fallback above. Self-maps
 * `skill -> skill` into this user's dictionary, the same safe pattern
 * `ensureAllTermsCovered` already uses (never overwrites an existing
 * mapping — only adds when the term isn't already a key). Called only after
 * a human clicks "Add" on a literal match findUnconfirmedLiteralSkillMatches
 * surfaced; from then on the term is a normal dictionary entry, recognized
 * by extractClaimedSkills like anything else, no fallback needed.
 */
export async function confirmSkillTerm(userId, skill) {
  const term = (skill || '').trim().toLowerCase();
  if (!term) return { aliases: (await getSkillDictionaryForUser(userId)).aliases };

  const doc = await SkillAliasDictionary.findOne({ userId });
  const currentDict = doc?.aliases || {};
  if (currentDict[term] !== undefined) return { aliases: currentDict };

  const aliases = { ...currentDict, [term]: term };
  await SkillAliasDictionary.findOneAndUpdate({ userId }, { aliases }, { upsert: true });
  return { aliases };
}
