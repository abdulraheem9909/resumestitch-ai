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
      currentSection = classifySectionHeading(line);
      return;
    }

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
      // One line in, one entry out — certifications are almost always a
      // single line each (unlike Education/Projects, no multi-line buffering).
      const dateMatch = line.match(DATE_TOKEN_REGEX);
      const withoutDate = dateMatch
        ? line.slice(0, dateMatch.index).replace(/[\s|,•\-–—]+$/, '').trim()
        : line;
      const split = trySplitHeaderLine(withoutDate);
      certifications.push({
        name: (split ? split.role : withoutDate).replace(/\s+/g, ' '),
        issuer: (split ? split.company : '').replace(/\s+/g, ' '),
        date: dateMatch ? dateMatch[0].trim() : '',
      });
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
        const split = trySplitHeaderLine(beforeDate);
        currentVolunteer = {
          role: (split ? split.role : beforeDate).replace(/\s+/g, ' '),
          organization: (split ? split.company : '').replace(/\s+/g, ' '),
          dateRange: dateMatch[0].trim(),
          description: '',
        };
      } else if (!currentVolunteer) {
        // Nothing buffered yet and no date on this line either — same
        // "something is better than nothing" fallback Projects already uses.
        currentVolunteer = { role: line.replace(/\s+/g, ' '), organization: '', dateRange: '', description: '' };
      } else {
        currentVolunteer.description = currentVolunteer.description
          ? `${currentVolunteer.description} ${line}`
          : line;
      }
      return;
    }
    // currentSection === 'experience' or null (unrecognized heading) — ignored here,
    // WORK EXPERIENCE is handled by segmentResume() instead.
  });

  flushProject();
  flushEducation();
  flushVolunteer();

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
  };
}
