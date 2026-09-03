// A short, explicit, hand-maintained list — same "explicit list, not a broad
// pattern" precedent as NON_VERIFIABLE_CLAIM_IDS in deterministicVerification.js.
// Longest phrases first so "head of" strips as one unit before a bare "head"
// rule could ever exist (it doesn't, deliberately — too likely to collide with
// a real title like "Head of Engineering" -> we only ever strip this exact list).
export const SENIORITY_QUALIFIER_TERMS = [
  'vice president',
  'head of',
  'founding',
  'principal',
  'director',
  'staff',
  'senior',
  'chief',
  'lead',
  'sr.',
  'sr',
  'vp',
];

const MIN_TITLE_LENGTH = 3;

function escapeRegex(term) {
  return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const STRIP_PATTERN = new RegExp(`\\b(${SENIORITY_QUALIFIER_TERMS.map(escapeRegex).join('|')})\\b`, 'gi');

// Never invents a title: this only ever removes words from the JD's own title
// text, or falls back to the resume's existing title unchanged. Nothing here
// is generated. See key-decisions-log.md.
export function suggestResumeTitle(jdTitle, fallbackTitle) {
  const source = (jdTitle || '').trim();
  if (!source) {
    return fallbackTitle || '';
  }

  const stripped = source
    .replace(STRIP_PATTERN, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,/-]+|[\s,/-]+$/g, '')
    .trim();

  if (stripped.length < MIN_TITLE_LENGTH) {
    return fallbackTitle || source;
  }

  return stripped;
}

// Only meaningful against a hand-edited title — the AI suggestion above can
// never contain one of these words in the first place, since it's built by
// stripping them out. This does not verify anything (no fabrication check);
// it only flags one specific, already-known pattern: reintroducing a
// seniority/scope word this resume was already determined not to back up.
export function findUnsupportedSeniorityTerms(text) {
  const matches = (text || '').match(STRIP_PATTERN) || [];
  return [...new Set(matches.map((match) => match.toLowerCase()))];
}
