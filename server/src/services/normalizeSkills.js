import { canonicalizeSkill } from './canonicalizeSkill.js';

export function normalizeSkills(skills) {
  const canonical = (skills || []).map(canonicalizeSkill);
  return [...new Set(canonical)];
}
