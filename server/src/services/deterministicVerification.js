import { canonicalizeSkill } from './canonicalizeSkill.js';

// Longer terms are matched first (matchers is sorted longest-first by
// buildSkillMatchers); a shorter term whose match span overlaps one already
// claimed is suppressed — otherwise e.g. "React.js" (-> react) would also
// register a spurious separate "js" (-> javascript) match, since "." is a
// word-boundary character and "js" is itself a valid standalone alias.
export function extractClaimedSkills(text, matchers, skillAliases) {
  const claimed = new Set();
  const claimedSpans = [];

  for (const { term, regex } of matchers) {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      const overlaps = claimedSpans.some(([spanStart, spanEnd]) => start < spanEnd && end > spanStart);
      if (!overlaps) {
        claimed.add(canonicalizeSkill(term, skillAliases));
        claimedSpans.push([start, end]);
      }
    }
  }

  return claimed;
}

// Canonical ids the skill badge (verifiedSkills.js) is meant to recognize,
// but that tagBullet.js/extractJdKeywords.js deliberately never tag as a
// skill in the first place — job titles and soft skills/activities, not
// concrete technologies (tagBullet.js's own prompt excludes exactly these:
// "mentoring, code reviews, architecture design, UI responsiveness, cross-
// functional collaboration"). Because these ids can never legitimately
// appear in an "allowed" set built from that vocabulary, treating one as a
// claim here would make it permanently, structurally impossible to prove —
// producing a false fabrication accusation for something completely benign,
// e.g. a tailored summary restating the job title "Full Stack Engineer".
// Deliberately a short, explicit, hand-maintained list, not a pattern-based
// rule — so a real technical skill can never be swept into it by accident.
const NON_VERIFIABLE_CLAIM_IDS = new Set([
  'mentorship',
  'code-review',
  'web-scraping',
  'unit-testing',
  'agile',
  'system-architecture',
  'frontend',
  'backend',
  'full-stack-engineer',
  'responsive-web-interfaces',
  'spa',
]);

// Used only for the fabrication check (buildResult/trustHumanEdit below) —
// never by verifiedSkills.js, which needs the full, unfiltered set for the
// display badge.
function extractVerifiableClaims(text, matchers, skillAliases) {
  return new Set([...extractClaimedSkills(text, matchers, skillAliases)].filter((id) => !NON_VERIFIABLE_CLAIM_IDS.has(id)));
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

function buildResult(generatedText, allowedSkills, allowedNumericText, matchers, skillAliases) {
  const claimedSkills = extractVerifiableClaims(generatedText, matchers, skillAliases);
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

// A human-edited bullet/summary is a direct claim by the person approving this
// resume, not the AI inventing something — there's nothing to fact-check against
// a source. Trust it outright, but still report what it claims (claimedSkills)
// so callers can credit those skills elsewhere (e.g. a live "still missing" view).
export function trustHumanEdit(text, matchers, skillAliases) {
  return {
    passed: true,
    fabricatedSkills: [],
    fabricatedMetrics: [],
    claimedSkills: [...extractVerifiableClaims(text || '', matchers, skillAliases)],
  };
}

/**
 * Node 6 (section 4): rule-based, no LLM. Verifies a single tailored bullet's
 * finalText against its source bullet. Kept decoupled from graph state — the
 * human-approval "re-check" action (section 4a) re-invokes this directly
 * against hand-edited text.
 */
export function verifyBullet({ generatedText, sourceBullet }, matchers, skillAliases) {
  const sourceText = sourceBullet.text || '';
  const allowedSkills = new Set([
    ...(sourceBullet.canonicalSkills || []),
    ...extractClaimedSkills(sourceText, matchers, skillAliases),
  ]);
  return buildResult(generatedText, [...allowedSkills], sourceText, matchers, skillAliases);
}

/**
 * Node 6 (section 4): verifies tailoredSummary.finalText against the three
 * inputs node 5 was constrained to (selected bullets, matched skills, years
 * of experience) — the same three sources the tailoring prompt was scoped to.
 */
export function verifySummary({ generatedText, matchedSkills, selectedBullets, yearsOfExperience }, matchers, skillAliases) {
  const allowedSkills = new Set([
    ...(matchedSkills || []),
    ...(selectedBullets || []).flatMap((bullet) => [
      ...(bullet.canonicalSkills || []),
      ...extractClaimedSkills(bullet.text || '', matchers, skillAliases),
    ]),
  ]);
  const allowedNumericText = [
    (selectedBullets || []).map((bullet) => bullet.text).join(' '),
    String(yearsOfExperience),
    String(Math.floor(yearsOfExperience)),
    String(Math.ceil(yearsOfExperience)),
  ].join(' ');

  return buildResult(generatedText, [...allowedSkills], allowedNumericText, matchers, skillAliases);
}
