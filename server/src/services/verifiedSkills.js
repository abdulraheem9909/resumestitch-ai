import { extractClaimedSkills } from './deterministicVerification.js';
import { canonicalizeSkill } from './canonicalizeSkill.js';

// Display-only signal — never feeds gap analysis, ATS scoring, or fabrication
// checks. Returns the subset of `skills` (original casing preserved) whose
// canonical form is genuinely claimed somewhere in `texts`.
export function computeVerifiedSkills(skills, texts) {
  const claimed = new Set();
  for (const text of texts || []) {
    for (const skill of extractClaimedSkills(text || '')) claimed.add(skill);
  }
  return (skills || []).filter((skill) => claimed.has(canonicalizeSkill(skill)));
}
