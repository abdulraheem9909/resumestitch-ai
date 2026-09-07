import SkillAliasDictionary from '../models/SkillAliasDictionary.js';

// Exported for reuse by verifiedSkills.js, which needs the same escaping to
// check a skill's own literal wording against text, separate from (and in
// addition to) the alias-based matching this module does.
export function escapeRegex(term) {
  return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
