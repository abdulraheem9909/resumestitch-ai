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
 * during a per-JD run.
 */
export async function addSkillAliasEntriesForUser(userId, proposedGroups) {
  const doc = await SkillAliasDictionary.findOne({ userId });
  const currentDict = doc?.aliases || {};
  const { mergedDict, addedEntries } = mergeAliasEntries(currentDict, proposedGroups);
  if (addedEntries.length === 0) return addedEntries;

  await SkillAliasDictionary.findOneAndUpdate({ userId }, { aliases: mergedDict }, { upsert: true });
  return addedEntries;
}
