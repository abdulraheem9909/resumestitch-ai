import { classifySectionHeading, isSectionHeading } from './resumeSectionHeadings.js';

const MONTH = '(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\\.?';
const NUMERIC_MONTH_YEAR = '\\d{1,2}/\\d{4}';
const NAMED_MONTH_YEAR = `${MONTH}\\s+\\d{4}`;
const YEAR_ONLY = '\\d{4}';

// Order matters: numeric (09/2024) and named-month (Jan 2024) forms must be tried
// before bare-year, so a numeric month isn't left stranded outside the match.
const DATE_TOKEN = `(?:${NUMERIC_MONTH_YEAR}|${NAMED_MONTH_YEAR}|${YEAR_ONLY})`;
export const DATE_RANGE_REGEX = new RegExp(
  `${DATE_TOKEN}\\s*(?:-|–|—|to)\\s*(?:${DATE_TOKEN}|Present|Current)`,
  'i'
);

// •/● etc. cover the bullet glyphs actually seen from Word/LibreOffice PDF exports,
// in addition to the plain '-' and '*' called out in the spec.
const BULLET_REGEX = /^[•●\-*]\s+(.+)$/;

export const PAGE_BREAK_REGEX = /^--\s*\d+\s*of\s*\d+\s*--$/i;

const HEADER_SEPARATORS = [' at ', ' @ ', ' • ', ' — ', ' – ', ' - ', ' | ', ', '];

// Signals a job-title line rather than a company name — used to disambiguate role
// vs. company when only one plain header line and one date-sharing line exist,
// since which of the two is the role vs. the company is not fixed across resumes.
const JOB_TITLE_KEYWORDS =
  /\b(engineer|developer|designer|manager|architect|analyst|consultant|specialist|director|lead|officer|intern|associate|coordinator|administrator|scientist|researcher|freelancer)\b/i;

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
        if (split) {
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
    // can't tell apart from a genuine single-line header like "Company C").
    const looksLikeContinuation = /^[a-z]/.test(line);
    const isContinuation =
      previousWasBullet &&
      bullets.length > 0 &&
      !isSectionHeading(line) &&
      (looksLikeContinuation || !startsNewHeaderBlock(lines, i));
    if (isContinuation) {
      bullets[bullets.length - 1].text += ` ${line}`;
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
