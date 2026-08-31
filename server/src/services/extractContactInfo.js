import {
  PAGE_BREAK_REGEX,
  BULLET_REGEX,
  DATE_RANGE_REGEX,
  EMAIL_REGEX,
  PHONE_REGEX,
  looksLikeContactLine,
  looksLikeTaglineLine,
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

  // The first non-empty line of a real resume is almost universally the
  // candidate's name.
  result.fullName = lines[0];

  let locationCaptured = false;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // Stop at the first sign the preamble is over: a recognized section
    // heading, or experience content starting with no heading at all.
    if (isSectionHeading(line) || BULLET_REGEX.test(line) || DATE_RANGE_REGEX.test(line)) break;

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
      // peel them off one at a time until none remain.
      let urlMatch = remainder.match(FULL_URL_REGEX);
      while (urlMatch) {
        const url = urlMatch[0];
        if (/linkedin/i.test(url)) {
          if (!result.linkedin) result.linkedin = url;
        } else if (!result.portfolio) {
          result.portfolio = url;
        }
        remainder = remainder.replace(url, ' ');
        urlMatch = remainder.match(FULL_URL_REGEX);
      }

      // Whatever's left after stripping phone/email/links is the location —
      // only taken from the first contact-shaped line, since that's where a
      // "City, Country • Phone • Email • Links" layout puts it.
      if (!locationCaptured) {
        const leftover = remainder
          .split('•')
          .map((part) => part.replace(/^[\s,|.\-–—]+|[\s,|.\-–—]+$/g, '').trim())
          .filter(Boolean)
          .join(', ');
        if (leftover) result.location = leftover;
        locationCaptured = true;
      }
      continue;
    }

    if (!result.title && looksLikeTaglineLine(line)) {
      result.title = line;
    }
  }

  return result;
}
