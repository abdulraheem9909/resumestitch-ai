import { canonicalizeSkill } from './canonicalizeSkill.js';
import { escapeRegex } from './skillAliasesStore.js';

// Same regex construction the store's matchers/matchesLiterally() already
// use (word-boundary, case-insensitive, internal whitespace collapsed to
// \s+) — used only as a fallback when a requested canonical skill has no
// entry at all in the alias dictionary (neither a key nor a value), so it
// can still be searched for via its own literal wording.
function buildLiteralMatcher(term) {
  return { term, regex: new RegExp(`\\b${escapeRegex(term).replace(/\s+/g, '\\s+')}\\b`, 'gi') };
}

// Counts non-overlapping mentions of one canonical skill (across all of its
// own aliases) in one text. A skill can have aliases where one is a
// substring of another at a word boundary (node/node.js/nodejs) — summing
// each alias's match count independently would double-count a single real
// mention ("Node.js" matches both \bnode\b and \bnode\.js\b). Instead, scan
// with every alias (longest-first, same order the store's matchers already
// return) and skip a match whose span overlaps one already counted — the
// same technique extractClaimedSkills() uses across different skills,
// scoped here to one skill's own alias set.
function countSkillOccurrences(matchers, text) {
  const spans = [];
  for (const { regex } of matchers) {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      const overlaps = spans.some(([spanStart, spanEnd]) => start < spanEnd && end > spanStart);
      if (!overlaps) spans.push([start, end]);
    }
  }
  return spans.length;
}

/**
 * Purely informational — never feeds gap analysis, ATS scoring, fabrication
 * checks, or the retry conditional. For each given canonical skill, counts
 * how many times it (or any of its known aliases, via the same dictionary
 * canonicalizeSkill.js/verifiedSkills.js already use) appears in the JD text
 * versus the resume bullet text, so a difference like "verified but the JD
 * says it three times and the resume says it once" is visible without
 * changing what counts as a match anywhere else.
 */
export function computeSkillFrequency(jdSnapshot, resumeBullets, canonicalSkills, matchers, skillAliases) {
  const skills = [...new Set(canonicalSkills || [])];
  if (skills.length === 0) return [];

  const jdText = jdSnapshot || '';
  const resumeText = (resumeBullets || []).map((bullet) => bullet.text || '').join('\n');

  return skills.map((skill) => {
    let skillMatchers = matchers.filter(({ term }) => canonicalizeSkill(term, skillAliases) === skill);
    if (skillMatchers.length === 0) skillMatchers = [buildLiteralMatcher(skill)];

    return {
      skill,
      resumeCount: countSkillOccurrences(skillMatchers, resumeText),
      jdCount: countSkillOccurrences(skillMatchers, jdText),
    };
  });
}
