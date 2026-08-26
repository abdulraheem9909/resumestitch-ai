const MONTH = '(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\\.?';
const NUMERIC_MONTH_YEAR = '\\d{1,2}/\\d{4}';
const NAMED_MONTH_YEAR = `${MONTH}\\s+\\d{4}`;
const YEAR_ONLY = '\\d{4}';

// Order matters: numeric (09/2024) and named-month (Jan 2024) forms must be tried
// before bare-year, so a numeric month isn't left stranded outside the match.
const DATE_TOKEN = `(?:${NUMERIC_MONTH_YEAR}|${NAMED_MONTH_YEAR}|${YEAR_ONLY})`;
const DATE_RANGE_REGEX = new RegExp(
  `${DATE_TOKEN}\\s*(?:-|–|—|to)\\s*(?:${DATE_TOKEN}|Present|Current)`,
  'i'
);

// •/● etc. cover the bullet glyphs actually seen from Word/LibreOffice PDF exports,
// in addition to the plain '-' and '*' called out in the spec.
const BULLET_REGEX = /^[•●\-*]\s+(.+)$/;

const PAGE_BREAK_REGEX = /^--\s*\d+\s*of\s*\d+\s*--$/i;

const HEADER_SEPARATORS = [' at ', ' @ ', ' • ', ' — ', ' – ', ' - ', ' | ', ', '];

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

function isSectionHeading(line) {
  const letters = line.replace(/[^A-Za-z]/g, '');
  return letters.length > 0 && letters === letters.toUpperCase() && line.length <= 40;
}

function trySplitHeaderLine(line) {
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

// Used when the date sits on its own line, so role/company must come from the
// buffered lines above it rather than from text shared with the date line.
function resolveRoleAndCompanyFromBuffer(headerBuffer) {
  if (headerBuffer.length >= 2) {
    return {
      role: headerBuffer[headerBuffer.length - 2],
      company: headerBuffer[headerBuffer.length - 1],
    };
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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const bulletMatch = line.match(BULLET_REGEX);
    if (bulletMatch) {
      // Ignore bullet-charactered lines seen before any job section is established
      // (e.g. a wrapped contact-info line that happens to start with the same glyph).
      if (currentRole || currentCompany || currentDateRange) {
        bullets.push({
          text: bulletMatch[1].trim(),
          role: currentRole,
          company: currentCompany,
          dateRange: currentDateRange,
        });
      }
      previousWasBullet = true;
      continue;
    }

    const dateMatch = line.match(DATE_RANGE_REGEX);
    if (dateMatch) {
      const leftover = (line.slice(0, dateMatch.index) + line.slice(dateMatch.index + dateMatch[0].length))
        .replace(/^[\s|,•\-–—]+|[\s|,•\-–—]+$/g, '')
        .trim();

      if (leftover) {
        const split = trySplitHeaderLine(leftover);
        if (split) {
          currentRole = split.role;
          currentCompany = split.company;
        } else {
          currentRole = leftover;
          const nextLine = lines[i + 1];
          const nextLineIsCompany =
            nextLine && !BULLET_REGEX.test(nextLine) && !DATE_RANGE_REGEX.test(nextLine) && !isSectionHeading(nextLine);
          if (nextLineIsCompany) {
            currentCompany = nextLine;
            i += 1; // consume it so it isn't also treated as a header line for the next section
          } else {
            currentCompany = headerBuffer.length ? headerBuffer[headerBuffer.length - 1] : '';
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
    // the start of the next job's header block (a date range follows shortly).
    // A lowercase-starting line is treated as a continuation regardless: real role/
    // company header lines are capitalized, so this also catches the one-line-away-
    // from-the-next-date-line case (e.g. a wrapped word like "collaboration" sitting
    // right before the next job's own header+date line, which the lookahead alone
    // can't tell apart from a genuine single-line header like "Company C").
    const looksLikeContinuation = /^[a-z]/.test(line);
    if (previousWasBullet && bullets.length > 0 && (looksLikeContinuation || !startsNewHeaderBlock(lines, i))) {
      bullets[bullets.length - 1].text += ` ${line}`;
      continue;
    }
    previousWasBullet = false;

    if (isSectionHeading(line)) {
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
