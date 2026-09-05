import {
  DATE_RANGE_REGEX,
  DATE_TOKEN_REGEX,
  PAGE_BREAK_REGEX,
  trySplitHeaderLine,
  BULLET_REGEX,
  looksLikeContactLine,
  looksLikeTaglineLine,
  looksLikeLocationLine,
} from './segmentResume.js';
import { classifySectionHeading, isSectionHeading } from './resumeSectionHeadings.js';

/**
 * Rule-based, deterministic extraction of the non-experience sections of a resume:
 * summary, education, projects, certifications, volunteer work, and the raw declared
 * skills list. No LLM calls, no rephrasing — everything is copied verbatim, since
 * these are preserved as-is in every generated resume rather than tailored per JD.
 * Sibling to segmentResume(), which handles WORK EXPERIENCE bullets; both share the
 * same heading classifier (resumeSectionHeadings.js) so they can never disagree on
 * what a heading means.
 */
export function segmentResumeSections(rawText) {
  const lines = (rawText || '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !PAGE_BREAK_REGEX.test(line));

  let currentSection = null;
  const summaryLines = [];
  const education = [];
  const projects = [];
  const skillsLines = [];
  const certifications = [];
  const volunteerWork = [];

  let pendingEducation = null; // { degree, dateRange } awaiting an institution line
  // A bare degree-name line seen with no date on it yet, awaiting the
  // institution+location+date line that some resumes put on the *next* line
  // instead of sharing the degree's own line.
  let pendingDegreeName = null;
  let currentProject = null; // { name, description } being accumulated
  let currentVolunteer = null; // { role, organization, dateRange, description } being accumulated
  // A real certification or volunteer-work entry's header (name/issuer, or
  // role/organization) is sometimes one line, but is just as often split
  // across two — title on its own line, then issuer/organization on the
  // next, with the date arriving on a third line by itself. Buffered here
  // until a date line resolves them into one entry, mirroring Education's
  // own pendingDegreeName buffer for exactly the same reason. Capped at 2
  // lines — a third dateless line in a row is ambiguous (same "no date ever
  // turns up" precedent Education already accepts) and is instead treated
  // as the start of the *next* entry, flushing whatever was pending as-is.
  let pendingCertificationLines = [];
  let pendingVolunteerHeaderLines = [];

  // Some PDFs' column layouts extract several section headings back-to-back
  // — e.g. "Core Skills" / "Education" / "Certificates" one after another —
  // with none of their actual content between them, followed by all three
  // sections' real content as one unbroken block. This parser has no way to
  // tell which of the stacked headings that content really belongs to, and
  // simply attributes it all to whichever heading it saw last. Tracked here
  // so resumes.js can flag every section in a stacked run as suspect and
  // hand it to the AI fallback, rather than silently trusting whichever one
  // happened to end up as currentSection.
  const ambiguousSections = new Set();
  let headingRunKinds = [];

  // Some resumes never label their summary with a heading at all — the paragraph
  // just sits under the name/contact/title block. sawAnyHeading gates a fallback
  // that treats leftover preamble prose (once name/contact/tagline lines are
  // excluded) as the summary, used only when no explicit SUMMARY-like heading is
  // ever found (summaryLines stays empty in that case).
  let sawAnyHeading = false;
  const impliedSummaryLines = [];

  function flushProject() {
    if (currentProject) {
      projects.push(currentProject);
      currentProject = null;
    }
  }

  function flushEducation() {
    if (pendingEducation) {
      education.push({
        degree: pendingEducation.degree,
        dateRange: pendingEducation.dateRange,
        institution: '',
        location: '',
      });
      pendingEducation = null;
    }
    pendingDegreeName = null;
  }

  function flushVolunteer() {
    if (currentVolunteer) {
      volunteerWork.push(currentVolunteer);
      currentVolunteer = null;
    }
  }

  // Resolves 1-2 buffered header lines (seen before a date was found) into a
  // primary/secondary field pair — shared by certifications (name/issuer)
  // and volunteer work (role/organization), since both can spread a single
  // entry's header across up to two lines before the date line itself.
  function resolveMultiLineHeader(bufferedLines) {
    if (bufferedLines.length === 0) return { primary: '', secondary: '' };
    if (bufferedLines.length === 1) {
      const split = trySplitHeaderLine(bufferedLines[0]);
      return split
        ? { primary: split.role, secondary: split.company }
        : { primary: bufferedLines[0], secondary: '' };
    }
    return { primary: bufferedLines[0], secondary: bufferedLines.slice(1).join(' ') };
  }

  function flushCertifications() {
    if (pendingCertificationLines.length > 0) {
      const { primary, secondary } = resolveMultiLineHeader(pendingCertificationLines);
      certifications.push({ name: primary, issuer: secondary, date: '' });
      pendingCertificationLines = [];
    }
  }

  function flushPendingVolunteerHeader() {
    if (pendingVolunteerHeaderLines.length > 0) {
      const { primary, secondary } = resolveMultiLineHeader(pendingVolunteerHeaderLines);
      volunteerWork.push({ role: primary, organization: secondary, dateRange: '', description: '' });
      pendingVolunteerHeaderLines = [];
    }
  }

  lines.forEach((line, index) => {
    if (!sawAnyHeading) {
      if (isSectionHeading(line)) {
        // fall through to the shared heading handling below
      } else if (index === 0) {
        // The first non-empty line of a real resume is the candidate's name —
        // never summary prose, even if it happens to look prose-like.
        return;
      } else if (looksLikeContactLine(line) || looksLikeTaglineLine(line) || looksLikeLocationLine(line)) {
        return;
      } else if (BULLET_REGEX.test(line) || DATE_RANGE_REGEX.test(line)) {
        // Experience content starting with no heading at all — stop treating
        // anything further as part of the preamble.
        sawAnyHeading = true;
        return;
      } else {
        impliedSummaryLines.push(line);
        return;
      }
    }

    if (isSectionHeading(line)) {
      sawAnyHeading = true;
      flushProject();
      flushEducation();
      flushVolunteer();
      flushPendingVolunteerHeader();
      flushCertifications();
      currentSection = classifySectionHeading(line);
      headingRunKinds.push(currentSection);
      return;
    }

    // The line right after a run of headings is real content — if that run
    // was 2+ headings long, every one of them is ambiguous (see
    // ambiguousSections above). A single, isolated heading followed by its
    // own content is the normal case and flags nothing.
    if (headingRunKinds.length > 1) {
      for (const kind of headingRunKinds) {
        if (kind) ambiguousSections.add(kind);
      }
    }
    headingRunKinds = [];

    if (currentSection === 'summary') {
      summaryLines.push(line);
      return;
    }

    if (currentSection === 'education') {
      const dateMatch = line.match(DATE_RANGE_REGEX);
      if (dateMatch) {
        const beforeDate = line
          .slice(0, dateMatch.index)
          .replace(/[\s|,•\-–—]+$/, '')
          .trim();
        if (pendingDegreeName) {
          // The degree name was already buffered from the previous (dateless)
          // line — this line is institution + location sharing a line with
          // the date instead (e.g. "University of Salford • Manchester,UK
          // 09/2024 - 01/2026").
          const split = trySplitHeaderLine(beforeDate);
          education.push({
            degree: pendingDegreeName,
            dateRange: dateMatch[0].trim(),
            institution: (split ? split.role : beforeDate).replace(/\s+/g, ' '),
            location: (split ? split.company : '').replace(/\s+/g, ' '),
          });
          pendingDegreeName = null;
        } else {
          // Today's original layout: the degree name and date share this line.
          flushEducation();
          pendingEducation = { degree: beforeDate.replace(/\s+/g, ' '), dateRange: dateMatch[0].trim() };
        }
      } else if (pendingEducation) {
        const split = trySplitHeaderLine(line);
        education.push({
          degree: pendingEducation.degree,
          dateRange: pendingEducation.dateRange,
          institution: split ? split.role : line,
          location: split ? split.company : '',
        });
        pendingEducation = null;
      } else if (!pendingDegreeName) {
        // A dateless line with nothing pending yet — buffer it as a candidate
        // degree name, in case the date turns up on the *next* line instead.
        pendingDegreeName = line.replace(/\s+/g, ' ');
      }
      // else: a second dateless line in a row with no date ever turning up —
      // ambiguous, leave the first buffered line as-is and drop this one.
      return;
    }

    if (currentSection === 'projects') {
      const endsWithSentencePunctuation = currentProject && /[.!:]$/.test(currentProject.description);
      const looksLikeNewProjectName =
        currentProject && endsWithSentencePunctuation && line.length <= 60 && !/^[a-z]/.test(line);
      if (!currentProject || looksLikeNewProjectName) {
        flushProject();
        currentProject = { name: line, description: '' };
      } else {
        currentProject.description = currentProject.description
          ? `${currentProject.description} ${line}`
          : line;
      }
      return;
    }

    if (currentSection === 'skills') {
      skillsLines.push(line);
      return;
    }

    if (currentSection === 'certifications') {
      // A real certification is a single line ("Name — Issuer, 2023") just as
      // often as it's spread across up to three ("Name" / "Issuer" / "2023"
      // each on their own line) — buffer dateless lines and only finalize
      // into one entry once a date turns up, or the section/file ends.
      const dateMatch = line.match(DATE_TOKEN_REGEX);
      if (dateMatch) {
        const remainder = line
          .slice(0, dateMatch.index)
          .replace(/[\s|,•\-–—]+$/, '')
          .trim();
        const lines = remainder ? [...pendingCertificationLines, remainder.replace(/\s+/g, ' ')] : pendingCertificationLines;
        const { primary, secondary } = resolveMultiLineHeader(lines);
        certifications.push({ name: primary, issuer: secondary, date: dateMatch[0].trim() });
        pendingCertificationLines = [];
      } else if (pendingCertificationLines.length >= 2) {
        // A third dateless line in a row — ambiguous, same "no date ever
        // turns up" precedent Education accepts. Flush what's buffered as
        // its own entry and start fresh, treating this as the next one.
        flushCertifications();
        pendingCertificationLines = [line.replace(/\s+/g, ' ')];
      } else {
        pendingCertificationLines.push(line.replace(/\s+/g, ' '));
      }
      return;
    }

    if (currentSection === 'volunteerWork') {
      const dateMatch = line.match(DATE_RANGE_REGEX);
      if (dateMatch) {
        flushVolunteer();
        const beforeDate = line
          .slice(0, dateMatch.index)
          .replace(/[\s|,•\-–—]+$/, '')
          .trim();
        const headerLines = beforeDate
          ? [...pendingVolunteerHeaderLines, beforeDate.replace(/\s+/g, ' ')]
          : pendingVolunteerHeaderLines;
        const { primary, secondary } = resolveMultiLineHeader(headerLines);
        currentVolunteer = {
          role: primary,
          organization: secondary,
          dateRange: dateMatch[0].trim(),
          description: '',
        };
        pendingVolunteerHeaderLines = [];
      } else if (currentVolunteer) {
        // A dateless line while a completed entry is active is usually its
        // description — but once that description already reads as a
        // finished sentence, a new short, capitalized line is more likely
        // the *next* entry's title starting (its own header spread across
        // dateless lines too) than a continuation. Exact same heuristic,
        // and the exact same "requires an already-complete-looking
        // description" guard, Projects already uses for this ambiguity —
        // deliberately does NOT fire on an entry's still-empty description,
        // since that's almost always its description's own first line, not
        // a new entry (tested live: an empty-description entry immediately
        // followed by "Ran weekly programming workshops for teenagers." was
        // wrongly read as a new entry until this guard was added).
        const looksLikeNewEntryStart =
          currentVolunteer.description &&
          /[.!:]$/.test(currentVolunteer.description) &&
          line.length <= 60 &&
          !/^[a-z]/.test(line);
        if (looksLikeNewEntryStart) {
          flushVolunteer();
          pendingVolunteerHeaderLines = [line.replace(/\s+/g, ' ')];
        } else {
          currentVolunteer.description = currentVolunteer.description
            ? `${currentVolunteer.description} ${line}`
            : line;
        }
      } else if (pendingVolunteerHeaderLines.length >= 2) {
        // A third dateless line in a row — same ambiguous case as
        // certifications: flush the pending header-only stub and start
        // fresh, treating this as the next entry's start.
        flushPendingVolunteerHeader();
        pendingVolunteerHeaderLines = [line.replace(/\s+/g, ' ')];
      } else {
        pendingVolunteerHeaderLines.push(line.replace(/\s+/g, ' '));
      }
      return;
    }
    // currentSection === 'experience' or null (unrecognized heading) — ignored here,
    // WORK EXPERIENCE is handled by segmentResume() instead.
  });

  flushProject();
  flushEducation();
  flushVolunteer();
  flushPendingVolunteerHeader();
  flushCertifications();

  // The file can end right after a run of stacked headings with no content
  // ever following (e.g. the last section on the page is genuinely empty) —
  // same ambiguity as mid-file, so flag it here too.
  if (headingRunKinds.length > 1) {
    for (const kind of headingRunKinds) {
      if (kind) ambiguousSections.add(kind);
    }
  }

  const skills = skillsLines
    .join(' ')
    .split(',')
    .map((skill) => skill.trim())
    .filter(Boolean);

  return {
    summary: summaryLines.length ? summaryLines.join(' ').trim() : impliedSummaryLines.join(' ').trim(),
    education,
    projects,
    skills,
    certifications,
    volunteerWork,
    ambiguousSections: [...ambiguousSections],
  };
}
