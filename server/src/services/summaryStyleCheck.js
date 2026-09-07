// A short, explicit, hand-maintained list — same "explicit list, not a broad
// pattern" precedent as SENIORITY_QUALIFIER_TERMS in suggestResumeTitle.js
// and NON_VERIFIABLE_CLAIM_IDS in deterministicVerification.js. Must stay in
// sync with the phrases named in tailorContent.js's SUMMARY_RULES prompt
// text — this is the deterministic backstop for that same rule, not a
// separate one.
export const SUMMARY_BANNED_PHRASES = [
  'results-driven',
  'proven track record',
  'detail-oriented',
  'team player',
  'leveraged cross-functional teams',
  'spearheaded',
  'dynamic',
  'passionate',
];

function escapeRegex(term) {
  return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// A bare "i" bounded by non-word characters on both sides already catches
// every first-person contraction too — "I'm", "I've", "I'd", and "I'll" all
// satisfy the trailing \b the moment the apostrophe (a non-word character)
// follows the "I".
const PRONOUN_PATTERN = /\b(i|my|me|myself|mine)\b/gi;
const PHRASE_PATTERN = new RegExp(`\\b(${SUMMARY_BANNED_PHRASES.map(escapeRegex).join('|')})\\b`, 'gi');

// Node 5's tailored-summary prompt already instructs the model not to do
// this (see SUMMARY_RULES in tailorContent.js) — that instruction alone
// isn't reliable enough by itself (found live: a real generation used "I
// am", "I have", and "proven track record" despite the rule being spelled
// out explicitly), so this is the deterministic check tailorContent() runs
// on every generation to decide whether the summary needs to be
// regenerated before a human ever sees it.
export function findSummaryStyleViolations(text) {
  const pronouns = (text || '').match(PRONOUN_PATTERN) || [];
  const phrases = (text || '').match(PHRASE_PATTERN) || [];
  return [...new Set([...pronouns, ...phrases].map((match) => match.toLowerCase()))];
}
