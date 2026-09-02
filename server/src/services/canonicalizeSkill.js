import { getSkillAliases } from './skillAliasesStore.js';

export function canonicalizeSkill(rawSkill) {
  const skillAliases = getSkillAliases();
  const normalized = (rawSkill || '').trim().toLowerCase();
  if (skillAliases[normalized]) return skillAliases[normalized];

  // A skill can be tagged with a trailing parenthetical annotation (e.g.
  // "Retrieval-Augmented Generation (RAG)") that isn't itself a dictionary
  // key even though the phrase before it is — strip it and retry before
  // falling back to treating the whole string as its own canonical id.
  const withoutParenthetical = normalized.replace(/\s*\([^)]*\)\s*$/, '').trim();
  if (withoutParenthetical && skillAliases[withoutParenthetical]) return skillAliases[withoutParenthetical];

  return normalized;
}
