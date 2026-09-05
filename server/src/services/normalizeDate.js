import { MONTH } from './segmentResume.js';

const MONTH_NUMBER = {
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  aug: '08',
  sep: '09',
  oct: '10',
  nov: '11',
  dec: '12',
};

const NUMERIC_MONTH_YEAR = /^(\d{1,2})\/(\d{4})$/;
const NAMED_MONTH_YEAR = new RegExp(`^(${MONTH})\\s+(\\d{4})$`, 'i');
const YEAR_ONLY = /^\d{4}$/;
const PRESENT_WORD = /^(?:present|current)$/i;

const DATE_TOKEN = `(?:\\d{1,2}/\\d{4}|${MONTH}\\s+\\d{4}|\\d{4}|Present|Current)`;
// Same separator tolerance DATE_RANGE_REGEX already has: a dash/en-dash/
// em-dash or "to" (optionally spaced), OR bare whitespace with no
// connecting character at all (the multi-column layout that strands the
// dash on its own disconnected line).
const RANGE_PATTERN = new RegExp(
  `^(${DATE_TOKEN})(?:\\s*(?:-|–|—|\\bto\\b)\\s*|\\s+)(${DATE_TOKEN})$`,
  'i'
);

// Normalizes one date token to this app's own "MM/YYYY" shape. Only ever
// reformats a token that already states a real month (named or numeric) —
// a bare year is returned completely unchanged, since inventing a month it
// never stated would violate this project's "never invent anything about
// me" principle. Anything unrecognized is returned unchanged too, so this
// can never make a date worse than it already was.
function normalizeToken(token) {
  const trimmed = (token || '').trim();
  if (!trimmed) return '';
  if (PRESENT_WORD.test(trimmed)) return 'Present';

  const numeric = trimmed.match(NUMERIC_MONTH_YEAR);
  if (numeric) return `${numeric[1].padStart(2, '0')}/${numeric[2]}`;

  const named = trimmed.match(NAMED_MONTH_YEAR);
  if (named) {
    const key = named[1].slice(0, 3).toLowerCase();
    const monthNumber = MONTH_NUMBER[key];
    if (monthNumber) return `${monthNumber}/${named[2]}`;
  }

  return trimmed;
}

/**
 * Reformats a resume's parsed date/date-range text into this app's own
 * "MM/YYYY" (or "MM/YYYY - MM/YYYY" / "MM/YYYY - Present") shape, so the
 * Education/Certifications/Volunteer-Work editor's month pickers
 * (client/src/lib/dateRange.js) can parse it back for editing instead of
 * always starting blank. Called once, at upload time, on the final
 * resolved date text (deterministic or AI-recovered) — never touches
 * anything already saved on an earlier upload. See key-decisions-log.md.
 */
export function normalizeDate(rawValue) {
  const trimmed = (rawValue || '').trim();
  if (!trimmed) return '';

  const range = trimmed.match(RANGE_PATTERN);
  if (range) {
    return `${normalizeToken(range[1])} - ${normalizeToken(range[2])}`;
  }

  return normalizeToken(trimmed);
}
