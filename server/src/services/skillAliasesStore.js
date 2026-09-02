import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_ALIASES_PATH = path.join(__dirname, '../../data/skillAliases.json');

// Exported for reuse by verifiedSkills.js, which needs the same escaping to
// check a skill's own literal wording against text, separate from (and in
// addition to) the alias-based matching this module does.
export function escapeRegex(term) {
  return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Longer terms first, so a multi-word term matches before a shorter
// substring of itself (moved here from deterministicVerification.js, which
// used to build this independently from its own separately-loaded copy of
// the dictionary).
function buildSkillMatchers(skillAliases) {
  const knownTerms = [...new Set([...Object.keys(skillAliases), ...Object.values(skillAliases)])].sort(
    (a, b) => b.length - a.length
  );
  return knownTerms.map((term) => ({
    term,
    regex: new RegExp(`\\b${escapeRegex(term).replace(/\s+/g, '\\s+')}\\b`, 'gi'),
  }));
}

let skillAliases;
let skillMatchers;

// Single owner of the in-memory dictionary and everything derived from it —
// canonicalizeSkill.js and deterministicVerification.js used to each load
// the file independently at module scope, which meant a write to disk (see
// addSkillAliasEntries below) would never be seen by an already-running
// process without a restart.
export function reloadSkillAliases() {
  try {
    skillAliases = JSON.parse(readFileSync(SKILL_ALIASES_PATH, 'utf-8'));
  } catch (err) {
    // A missing (or, in the extreme, unreadable) dictionary file must never
    // take the whole server down — start with no known aliases rather than
    // crashing. addSkillAliasEntries() will create the file (and its
    // directory) the first time anything is actually learned.
    if (err.code !== 'ENOENT') throw err;
    skillAliases = {};
  }
  skillMatchers = buildSkillMatchers(skillAliases);
}

reloadSkillAliases();

export function getSkillAliases() {
  return skillAliases;
}

export function getSkillMatchers() {
  return skillMatchers;
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
 * Impure wrapper: merges, persists to disk, and reloads the in-memory caches
 * so the change is visible to the rest of this same process immediately —
 * called by the resume-upload route (resumes.js), never during a per-JD run.
 */
export function addSkillAliasEntries(proposedGroups) {
  const { mergedDict, addedEntries } = mergeAliasEntries(getSkillAliases(), proposedGroups);
  if (addedEntries.length === 0) return addedEntries;

  mkdirSync(path.dirname(SKILL_ALIASES_PATH), { recursive: true });
  writeFileSync(SKILL_ALIASES_PATH, `${JSON.stringify(mergedDict, null, 2)}\n`, 'utf-8');
  reloadSkillAliases();
  return addedEntries;
}
