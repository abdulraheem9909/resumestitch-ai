import {
  PAGE_BREAK_REGEX,
  BULLET_REGEX,
  DATE_RANGE_REGEX,
  EMAIL_REGEX,
  PHONE_REGEX,
  looksLikeContactLine,
  looksLikeTaglineLine,
  looksLikeLocationLine,
} from './segmentResume.js';
import { isSectionHeading } from './resumeSectionHeadings.js';

// Unlike the shared URL_REGEX (a cheap boolean "does this line contain a link"
// check used for line classification), this one captures the *whole* link —
// domain plus any path — since a bare "linkedin.com" with the profile path
// chopped off isn't a usable prefill value.
const FULL_URL_REGEX = /(https?:\/\/\S+)|(\b[a-z0-9-]+\.(?:com|io|dev|net|org|co|app|me|ai|uk)(?:\/[^\s•,]*)?)/i;

/**
 * Rule-based, deterministic extraction of upload-form prefill fields (full
 * name, title, location, phone, email, LinkedIn, portfolio) from a resume's
 * preamble — the same name/contact/tagline block segmentResumeSections()
 * already recognizes and skips when falling back to an implied summary. No
 * LLM calls: every value is copied verbatim from the file. This is only ever
 * used to pre-populate the upload form's editable fields, never to write
 * personalInfo directly — the user still reviews/edits before saving.
 */
export function extractContactInfo(rawText) {
  const lines = (rawText || '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !PAGE_BREAK_REGEX.test(line));

  const result = { fullName: '', title: '', location: '', phone: '', email: '', linkedin: '', portfolio: '' };
  if (lines.length === 0) return result;

  // The first non-empty line of a real resume is almost always the
  // candidate's name — unless it clearly reads as something else (a
  // tagline, a contact line, or a bare location line), which some layouts
  // put first instead. Found live: a resume whose actual name never
  // appears in the header block at all — extracted deep inside its Work
  // Experience section instead, a multi-column PDF layout artifact —
  // leaving line 0 as its tagline. Guessing wrong here (silently prefilling
  // a job title as someone's name) is worse than leaving fullName blank for
  // the user to type by hand, so it's only ever set when line 0 doesn't
  // already look like one of those other things — which still flows
  // through the same per-line classification below instead, so a real
  // tagline/location on line 0 is still captured correctly, just not as a name.
  if (!looksLikeContactLine(lines[0]) && !looksLikeTaglineLine(lines[0]) && !looksLikeLocationLine(lines[0])) {
    result.fullName = lines[0];
  }

  let locationCaptured = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Stop at the first sign the preamble is over: a recognized section
    // heading, or experience content starting with no heading at all.
    // Never breaks on line 0 itself — a resume's very first line is always
    // still part of the preamble, whatever it turns out to be.
    if (i > 0 && (isSectionHeading(line) || BULLET_REGEX.test(line) || DATE_RANGE_REGEX.test(line))) break;

    if (looksLikeContactLine(line)) {
      let remainder = line;

      const emailMatch = remainder.match(EMAIL_REGEX);
      if (emailMatch) {
        if (!result.email) result.email = emailMatch[0];
        remainder = remainder.replace(emailMatch[0], ' ');
      }

      const phoneMatch = remainder.match(PHONE_REGEX);
      if (phoneMatch) {
        if (!result.phone) result.phone = phoneMatch[0].trim();
        remainder = remainder.replace(phoneMatch[0], ' ');
      }

      // Multiple URL-ish tokens can share one line (e.g. LinkedIn + portfolio) —
      // peel them off one at a time until none remain. Tracks whichever field
      // the last (rightmost) one was assigned to, since that's the only one
      // that could have been cut short by a PDF line-wrap (see below).
      let urlMatch = remainder.match(FULL_URL_REGEX);
      let lastAssignedField = null;
      let lastAssignedUrl = '';
      while (urlMatch) {
        const url = urlMatch[0];
        if (/linkedin/i.test(url)) {
          if (!result.linkedin) {
            result.linkedin = url;
            lastAssignedField = 'linkedin';
            lastAssignedUrl = url;
          }
        } else if (!result.portfolio) {
          result.portfolio = url;
          lastAssignedField = 'portfolio';
          lastAssignedUrl = url;
        }
        remainder = remainder.replace(url, ' ');
        urlMatch = remainder.match(FULL_URL_REGEX);
      }

      // A URL can itself get PDF-wrapped mid-hostname/path, stranding its
      // tail as a bare fragment on the very next line (e.g.
      // "https://abdulraheem-" / "rho.vercel.app") — only worth checking
      // when the URL just found sat right at this line's own end, since one
      // followed by real text on the same line was never cut short.
      // Requires the fragment to contain a "." or "/" (a real continuation
      // of a hostname/path) so a genuinely unrelated single-word next line
      // (e.g. a one-word tagline) is never mistaken for one.
      if (lastAssignedField && line.trimEnd().endsWith(lastAssignedUrl)) {
        const nextLine = lines[i + 1];
        const looksLikeBareUrlContinuation =
          nextLine &&
          !/\s/.test(nextLine) &&
          /[./]/.test(nextLine) &&
          !isSectionHeading(nextLine) &&
          !BULLET_REGEX.test(nextLine) &&
          !DATE_RANGE_REGEX.test(nextLine);
        if (looksLikeBareUrlContinuation) {
          result[lastAssignedField] += nextLine;
          i += 1;
        }
      }

      // Whatever's left after stripping phone/email/links is the location,
      // taken from the first contact-shaped line that actually has leftover
      // text — a "City, Country • Phone • Email • Links" layout puts it
      // here, but a line that's only ever a bare email/phone/URL (location
      // stated on its own separate line instead) leaves nothing behind, so
      // locationCaptured only locks once something real was actually found
      // — otherwise a later line never gets a chance to supply it.
      if (!locationCaptured) {
        // "·" (middle dot) is what this app's own resume export actually
        // joins the contact line with, alongside "•" (bullet) — splitting
        // on only one of the two left the other's separators un-split,
        // dumping the whole line into "location" verbatim, dots and all.
        const leftover = remainder
          .split(/[•·]/)
          .map((part) => part.replace(/^[\s,|.\-–—]+|[\s,|.\-–—]+$/g, '').trim())
          .filter(Boolean)
          .join(', ');
        if (leftover) {
          result.location = leftover;
          locationCaptured = true;
        }
      }
      continue;
    }

    // A bare "City, Country" (or similar) line with no phone/email/URL on it
    // at all — some layouts put contact details and location on entirely
    // separate lines rather than sharing one. Found live: "Dubai, 00000,
    // United Arab Emirates" has no digit run long enough to look like a
    // phone number, so it never reaches looksLikeContactLine at all.
    if (!locationCaptured && looksLikeLocationLine(line)) {
      result.location = line;
      locationCaptured = true;
      continue;
    }

    if (!result.title && looksLikeTaglineLine(line)) {
      result.title = line;
    }
  }

  return result;
}
