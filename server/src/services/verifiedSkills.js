import { extractClaimedSkills } from './deterministicVerification.js';
import { canonicalizeSkill } from './canonicalizeSkill.js';
import { escapeRegex } from './skillAliasesStore.js';

// Whether `skill`'s own literal wording (not any alias of it) appears in any
// of `texts` — distinguishes an "exact" match (safe even against a strict,
// literal-keyword-only ATS) from a "partial" one (genuinely the same skill,
// but only recognizable through the alias dictionary).
function matchesLiterally(skill, texts) {
  const term = (skill || '').trim();
  if (!term) return false;
  const regex = new RegExp(`\\b${escapeRegex(term).replace(/\s+/g, '\\s+')}\\b`, 'i');
  return (texts || []).some((text) => regex.test(text || ''));
}

/**
 * Display-only signal — never feeds gap analysis, ATS scoring, or fabrication
 * checks. `verifiedSkills` is the subset of `skills` (original casing
 * preserved) whose canonical form is genuinely claimed somewhere in `texts`.
 * `skillMatchTypes` says, for each of those, whether the skill's own literal
 * wording was found ('exact') or only a different alias of the same concept
 * was ('partial') — e.g. a skill badge "Node.js" backed by bullet text that
 * only ever says "Node".
 */
export function computeVerifiedSkills(skills, texts, matchers, skillAliases) {
  const claimed = new Set();
  for (const text of texts || []) {
    for (const skill of extractClaimedSkills(text || '', matchers, skillAliases)) claimed.add(skill);
  }

  const verifiedSkills = [];
  const skillMatchTypes = {};
  for (const skill of skills || []) {
    if (!claimed.has(canonicalizeSkill(skill, skillAliases))) continue;
    verifiedSkills.push(skill);
    skillMatchTypes[skill] = matchesLiterally(skill, texts) ? 'exact' : 'partial';
  }

  return { verifiedSkills, skillMatchTypes };
}
