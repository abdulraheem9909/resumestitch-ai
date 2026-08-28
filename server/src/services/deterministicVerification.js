import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { canonicalizeSkill } from './canonicalizeSkill.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const skillAliases = JSON.parse(readFileSync(path.join(__dirname, '../../data/skillAliases.json'), 'utf-8'));

function escapeRegex(term) {
  return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// All known surface forms (alias keys + their canonical values), longest
// first so multi-word terms match before a shorter substring of themselves.
const knownTerms = [...new Set([...Object.keys(skillAliases), ...Object.values(skillAliases)])].sort(
  (a, b) => b.length - a.length
);

const skillMatchers = knownTerms.map((term) => ({
  term,
  regex: new RegExp(`\\b${escapeRegex(term).replace(/\s+/g, '\\s+')}\\b`, 'gi'),
}));

// Longer terms are matched first (skillMatchers is sorted longest-first); a
// shorter term whose match span overlaps one already claimed is suppressed —
// otherwise e.g. "React.js" (-> react) would also register a spurious
// separate "js" (-> javascript) match, since "." is a word-boundary
// character and "js" is itself a valid standalone alias.
function extractClaimedSkills(text) {
  const claimed = new Set();
  const claimedSpans = [];

  for (const { term, regex } of skillMatchers) {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      const overlaps = claimedSpans.some(([spanStart, spanEnd]) => start < spanEnd && end > spanStart);
      if (!overlaps) {
        claimed.add(canonicalizeSkill(term));
        claimedSpans.push([start, end]);
      }
    }
  }

  return claimed;
}

const NUMERIC_TOKEN_PATTERN = /\d+(?:\.\d+)?(?:%|x|k|m|\+)?/gi;

function extractNumericTokens(text) {
  return new Set(((text || '').match(NUMERIC_TOKEN_PATTERN) || []).map((token) => token.toLowerCase()));
}

function diffNumericTokens(generatedText, allowedText) {
  const claimed = extractNumericTokens(generatedText);
  const allowed = extractNumericTokens(allowedText);
  return [...claimed].filter((token) => !allowed.has(token));
}

function buildResult(generatedText, allowedSkills, allowedNumericText) {
  const claimedSkills = extractClaimedSkills(generatedText);
  const allowed = new Set(allowedSkills);
  const fabricatedSkills = [...claimedSkills].filter((skill) => !allowed.has(skill));
  const fabricatedMetrics = diffNumericTokens(generatedText, allowedNumericText);

  return {
    passed: fabricatedSkills.length === 0 && fabricatedMetrics.length === 0,
    fabricatedSkills,
    fabricatedMetrics,
    claimedSkills: [...claimedSkills],
  };
}

/**
 * Node 6 (section 4): rule-based, no LLM. Verifies a single tailored bullet's
 * finalText against its source bullet. Kept decoupled from graph state — the
 * human-approval "re-check" action (section 4a) re-invokes this directly
 * against hand-edited text.
 */
export function verifyBullet({ generatedText, sourceBullet }) {
  return buildResult(generatedText, sourceBullet.canonicalSkills || [], sourceBullet.text || '');
}

/**
 * Node 6 (section 4): verifies tailoredSummary.finalText against the three
 * inputs node 5 was constrained to (selected bullets, matched skills, years
 * of experience) — the same three sources the tailoring prompt was scoped to.
 */
export function verifySummary({ generatedText, matchedSkills, selectedBullets, yearsOfExperience }) {
  const allowedSkills = new Set([
    ...(matchedSkills || []),
    ...(selectedBullets || []).flatMap((bullet) => bullet.canonicalSkills || []),
  ]);
  const allowedNumericText = [
    (selectedBullets || []).map((bullet) => bullet.text).join(' '),
    String(yearsOfExperience),
    String(Math.floor(yearsOfExperience)),
    String(Math.ceil(yearsOfExperience)),
  ].join(' ');

  return buildResult(generatedText, [...allowedSkills], allowedNumericText);
}
