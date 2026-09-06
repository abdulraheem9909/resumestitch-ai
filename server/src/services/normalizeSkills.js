import { canonicalizeSkill } from './canonicalizeSkill.js';

export function normalizeSkills(skills, skillAliases) {
  const canonical = (skills || []).map((skill) => canonicalizeSkill(skill, skillAliases));
  return [...new Set(canonical)];
}
