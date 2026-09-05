import { classifySectionHeading, isSectionHeading } from './resumeSectionHeadings.js';

const MONTH = '(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\\.?';
const NUMERIC_MONTH_YEAR = '\\d{1,2}/\\d{4}';
const NAMED_MONTH_YEAR = `${MONTH}\\s+\\d{4}`;
const YEAR_ONLY = '\\d{4}';

// Order matters: numeric (09/2024) and named-month (Jan 2024) forms must be tried
// before bare-year, so a numeric month isn't left stranded outside the match.
const DATE_TOKEN = `(?:${NUMERIC_MONTH_YEAR}|${NAMED_MONTH_YEAR}|${YEAR_ONLY})`;
// Unlike DATE_TOKEN, deliberately excludes a bare 4-digit year — this is only
// used for the no-separator fallback below, where a bare year would be far
// too loose (any two 4-digit numbers in running text) to safely treat as a
// date range without an explicit separator between them.
const SPECIFIC_DATE_TOKEN = `(?:${NUMERIC_MONTH_YEAR}|${NAMED_MONTH_YEAR})`;
export const DATE_RANGE_REGEX = new RegExp(
  `${DATE_TOKEN}\\s*(?:-|–|—|to)\\s*(?:${DATE_TOKEN}|Present|Current)` +
    // Some PDFs' two-column layouts (job details left, date range right)
    // extract the connecting dash onto its own disconnected line, leaving
    // e.g. "Oct 2023 Present" with nothing but whitespace between the two
    // dates. Recognize that shape too, but only for specific month-bearing
    // tokens (never a bare year) to keep it safe.
    `|${SPECIFIC_DATE_TOKEN}\\s+(?:${SPECIFIC_DATE_TOKEN}|Present|Current)`,
  'i'
);
// A single date, not a range — e.g. a certification's trailing "2023" or
// "Jun 2023". Anchored to the end of the line, since a one-line
// certification entry's date (when present at all) is always its trailing
// token, never a range.
export const DATE_TOKEN_REGEX = new RegExp(`${DATE_TOKEN}\\s*$`, 'i');

// •/● etc. cover the bullet glyphs actually seen from Word/LibreOffice PDF exports,
// in addition to the plain '-' and '*' called out in the spec.
export const BULLET_REGEX = /^[•●\-*]\s+(.+)$/;

export const PAGE_BREAK_REGEX = /^--\s*\d+\s*of\s*\d+\s*--$/i;

const HEADER_SEPARATORS = [' at ', ' @ ', ' • ', ' — ', ' – ', ' - ', ' | ', ', '];

// Signals a job-title line rather than a company name — used to disambiguate role
// vs. company when only one plain header line and one date-sharing line exist,
// since which of the two is the role vs. the company is not fixed across resumes.
export const JOB_TITLE_KEYWORDS =
  /\b(engineer|developer|designer|manager|architect|analyst|consultant|specialist|director|lead|officer|intern|associate|coordinator|administrator|scientist|researcher|freelancer|supervisor|assistant|technician|representative|operator|agent|clerk)\b/i;

// Contact-info line detection — shared by segmentResumeSections() (to recognize
// and skip name/contact/tagline lines when falling back to an implied summary)
// and extractContactInfo() (to actually pull phone/email/links/location out of
// those same lines for the upload-form prefill).
export const EMAIL_REGEX = /[^\s@]+@[^\s@]+\.[^\s@]+/;
export const PHONE_REGEX = /(\+?\d[\d\s().-]{7,}\d)/;
export const URL_REGEX = /(https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(com|io|dev|net|org|co|app|me|ai|uk)\b/i;

export function looksLikeContactLine(line) {
  return EMAIL_REGEX.test(line) || PHONE_REGEX.test(line) || URL_REGEX.test(line);
}

// A short, punctuation-free job-title tagline (e.g. "Software Engineer" sitting
// under the candidate's name) rather than a sentence of real summary prose.
export function looksLikeTaglineLine(line) {
  const wordCount = line.trim().split(/\s+/).filter(Boolean).length;
  return wordCount > 0 && wordCount <= 6 && !/[.!?]$/.test(line) && JOB_TITLE_KEYWORDS.test(line);
}

// A bare "City, Region, Country" (or "City, Postal, Country") address line —
// distinguishable from a real sentence of summary prose by having no verbs at
// all, just short Capitalized/numeric segments joined by commas, no sentence-
// ending punctuation. Unlike a contact line, it has no email/phone/URL of its
// own to be recognized by looksLikeContactLine — this is what's left when a
// resume states a location on its own line, with nothing else on it.
const LOCATION_SEGMENT = /^[A-Z0-9][A-Za-z0-9.'-]*(?:\s+(?:of|and|the|[A-Z0-9][A-Za-z0-9.'-]*))*$/;
export function looksLikeLocationLine(line) {
  const trimmed = line.trim();
  if (!trimmed || /[.!?]$/.test(trimmed)) return false;
  const segments = trimmed.split(',').map((segment) => segment.trim()).filter(Boolean);
  if (segments.length < 2) return false;
  return segments.every((segment) => segment.split(/\s+/).length <= 4 && LOCATION_SEGMENT.test(segment));
}

const MAX_HEADER_BUFFER = 2;

// Distinguishes a wrapped bullet continuation from the start of a new job's header
// block by peeking ahead for a date-range line before the next bullet turns up.
function startsNewHeaderBlock(lines, fromIndex) {
  for (let j = fromIndex; j < lines.length && j < fromIndex + MAX_HEADER_BUFFER + 1; j++) {
    if (BULLET_REGEX.test(lines[j])) return false;
    if (DATE_RANGE_REGEX.test(lines[j])) return true;
  }
  return false;
}

// A bullet ending in a trailing comma, colon, or semicolon, or with an
// unmatched opening parenthesis, is unambiguously still mid-sentence — the
// very next line must be its continuation no matter how it's capitalized or
// how soon the next job's date range turns up. This is what the capitalized-
// line + startsNewHeaderBlock lookahead alone can't tell apart: a
// continuation line starting with a proper noun (e.g. "OpenAI GPT-4,
// LangChain, Pinecone), deployed on AWS.") looks identical to a genuine new
// header line to that heuristic, since both are capitalized and both can
// have the next job's real header/date sitting a line or two later.
function bulletTextLooksUnfinished(text) {
  const trimmed = (text || '').trimEnd();
  if (/[,:;]$/.test(trimmed)) return true;
  const opens = (trimmed.match(/\(/g) || []).length;
  const closes = (trimmed.match(/\)/g) || []).length;
  return opens > closes;
}

export function trySplitHeaderLine(line) {
  for (const separator of HEADER_SEPARATORS) {
    const index = line.indexOf(separator);
    if (index !== -1) {
      return {
        role: line.slice(0, index).trim(),
        company: line.slice(index + separator.length).trim(),
      };
    }
  }
  return null;
}

// Resolves which of two candidate strings is the role vs. the company. Defaults to
// treating `roleGuess`/`companyGuess` as already correctly assigned, but flips them
// when only the company-guess actually looks like a job title — resumes disagree on
// whether the role or the company shares its line with the date, so position alone
// isn't a reliable signal.
function pickRoleAndCompany(roleGuess, companyGuess) {
  const roleGuessLooksLikeTitle = JOB_TITLE_KEYWORDS.test(roleGuess);
  const companyGuessLooksLikeTitle = JOB_TITLE_KEYWORDS.test(companyGuess);
  if (!roleGuessLooksLikeTitle && companyGuessLooksLikeTitle) {
    return { role: companyGuess, company: roleGuess };
  }
  return { role: roleGuess, company: companyGuess };
}

// Used when the date sits on its own line, so role/company must come from the
// buffered lines above it rather than from text shared with the date line.
function resolveRoleAndCompanyFromBuffer(headerBuffer) {
  if (headerBuffer.length >= 2) {
    return pickRoleAndCompany(headerBuffer[headerBuffer.length - 2], headerBuffer[headerBuffer.length - 1]);
  }
  if (headerBuffer.length === 1) {
    return trySplitHeaderLine(headerBuffer[0]) || { role: '', company: headerBuffer[0] };
  }
  return { role: '', company: '' };
}

/**
 * Rule-based, deterministic segmentation of plain resume text into bullets.
 * No LLM calls — job sections are detected from date-range lines, and the
 * header lines immediately preceding (or, when the date shares its line with
 * only the role, immediately following) a date range are treated as role/company.
 */
export function segmentResume(rawText) {
  const lines = (rawText || '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !PAGE_BREAK_REGEX.test(line));

  const bullets = [];
  let headerBuffer = [];
  let currentRole = '';
  let currentCompany = '';
  let currentDateRange = '';
  let previousWasBullet = false;
  // True before any heading is seen, and under an unrecognized heading — preserves
  // today's permissive behavior. Set false under EDUCATION/PROJECTS/SKILLS/SUMMARY so
  // their content (which can itself be bullet- or date-shaped, e.g. a degree's own
  // date range) is never mistaken for a new job section.
  let inExperienceSection = true;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const bulletMatch = line.match(BULLET_REGEX);
    if (bulletMatch) {
      // Ignore bullet-charactered lines seen before any job section is established
      // (e.g. a wrapped contact-info line that happens to start with the same glyph),
      // and any bullet-shaped line inside a non-experience section (e.g. PROJECTS).
      if (inExperienceSection && (currentRole || currentCompany || currentDateRange)) {
        bullets.push({
          text: bulletMatch[1].trim(),
          role: currentRole,
          company: currentCompany,
          dateRange: currentDateRange,
        });
      }
      // Only set when inExperienceSection: otherwise a bullet-shaped line inside e.g.
      // PROJECTS would make the *next* plain line look like a continuation of the
      // last real (experience) bullet, wrongly appending unrelated text to it.
      previousWasBullet = inExperienceSection;
      continue;
    }

    const dateMatch = line.match(DATE_RANGE_REGEX);
    if (dateMatch && !inExperienceSection) {
      // A dated line inside e.g. EDUCATION (a degree's own date range) — never a new
      // job header. Without this guard it would corrupt currentRole/currentCompany.
      continue;
    }
    if (dateMatch) {
      // Only text *before* the date is ever role/company — trailing text after an
      // end-date on the same line is stray formatting (e.g. an employment-type/
      // location aside typed after the date), never part of the header itself.
      const leftover = line
        .slice(0, dateMatch.index)
        .replace(/^[\s|,•\-–—]+|[\s|,•\-–—]+$/g, '')
        .trim();

      if (leftover) {
        const split = trySplitHeaderLine(leftover);
        // A successful split of the leftover isn't automatically the real
        // header — e.g. "Manchester, UK" splits cleanly on its comma into
        // "Manchester" / "UK", but that's a location sharing the date's line,
        // not a role/company. If neither side reads as a job title, and the
        // line(s) buffered just above already look like a complete, self-
        // contained "Company — Role" header on their own, trust that instead.
        const splitLooksLikeATitle = split && (JOB_TITLE_KEYWORDS.test(split.role) || JOB_TITLE_KEYWORDS.test(split.company));
        const bufferedSplit = headerBuffer.length ? trySplitHeaderLine(headerBuffer[headerBuffer.length - 1]) : null;
        if (split && !splitLooksLikeATitle && bufferedSplit) {
          const resolved = pickRoleAndCompany(bufferedSplit.role, bufferedSplit.company);
          currentRole = resolved.role;
          currentCompany = resolved.company;
        } else if (split) {
          currentRole = split.role;
          currentCompany = split.company;
        } else {
          const nextLine = lines[i + 1];
          const nextLineIsCompany =
            nextLine && !BULLET_REGEX.test(nextLine) && !DATE_RANGE_REGEX.test(nextLine) && !isSectionHeading(nextLine);
          if (nextLineIsCompany) {
            const resolved = pickRoleAndCompany(leftover, nextLine);
            currentRole = resolved.role;
            currentCompany = resolved.company;
            i += 1; // consume it so it isn't also treated as a header line for the next section
          } else {
            const resolved = pickRoleAndCompany(leftover, headerBuffer.length ? headerBuffer[headerBuffer.length - 1] : '');
            currentRole = resolved.role;
            currentCompany = resolved.company;
          }
        }
      } else {
        const resolved = resolveRoleAndCompanyFromBuffer(headerBuffer);
        currentRole = resolved.role;
        currentCompany = resolved.company;
      }

      currentDateRange = dateMatch[0].trim();
      headerBuffer = [];
      previousWasBullet = false;
      continue;
    }

    // A plain line right after a bullet is a wrapped continuation of that bullet's
    // text (PDF extraction breaks long bullets across lines) — unless it's actually
    // the start of the next job's header block (a date range follows shortly), or a
    // section heading. The heading check must win outright: for the *last* job in a
    // resume there is no later date line to find, so startsNewHeaderBlock can never
    // signal "new header" on its own — without this, EDUCATION/PROJECTS/SKILLS and
    // everything after them would get silently swallowed into the final bullet.
    // A lowercase-starting line is treated as a continuation regardless: real role/
    // company header lines are capitalized, so this also catches the one-line-away-
    // from-the-next-date-line case (e.g. a wrapped word like "collaboration" sitting
    // right before the next job's own header+date line, which the lookahead alone
    // can't tell apart from a genuine single-line header like "Company C"). Same for
    // a bullet left mid-sentence (trailing comma/colon, or an unclosed parenthesis) —
    // that's a stronger, capitalization-independent signal than the lookahead below.
    const looksLikeContinuation = /^[a-z]/.test(line);
    const previousBulletUnfinished =
      previousWasBullet && bullets.length > 0 && bulletTextLooksUnfinished(bullets[bullets.length - 1].text);
    const isContinuation =
      previousWasBullet &&
      bullets.length > 0 &&
      !isSectionHeading(line) &&
      (looksLikeContinuation || previousBulletUnfinished || !startsNewHeaderBlock(lines, i));
    if (isContinuation) {
      const currentBullet = bullets[bullets.length - 1];
      // A hyphenated compound word (e.g. "cross-functional") can itself fall
      // across the line wrap, landing as "cross-" / "functional" — the hyphen
      // is real and must stay, but joining with the usual space would leave a
      // stray "cross- functional". No space belongs between a trailing
      // word-hyphen and its continuation.
      const joiner = /\w-$/.test(currentBullet.text) ? '' : ' ';
      currentBullet.text += `${joiner}${line}`;
      continue;
    }
    previousWasBullet = false;

    if (isSectionHeading(line)) {
      const kind = classifySectionHeading(line);
      inExperienceSection = kind === 'experience' || kind === null;
      headerBuffer = [];
      continue;
    }

    headerBuffer.push(line);
    if (headerBuffer.length > MAX_HEADER_BUFFER) {
      headerBuffer.shift();
    }
  }

  return bullets;
}
