import { DATE_RANGE_REGEX, PAGE_BREAK_REGEX, trySplitHeaderLine } from './segmentResume.js';
import { classifySectionHeading, isSectionHeading } from './resumeSectionHeadings.js';

/**
 * Rule-based, deterministic extraction of the non-experience sections of a resume:
 * summary, education, projects, and the raw declared skills list. No LLM calls, no
 * rephrasing — everything is copied verbatim, since these are preserved as-is in
 * every generated resume rather than tailored per JD. Sibling to segmentResume(),
 * which handles WORK EXPERIENCE bullets; both share the same heading classifier
 * (resumeSectionHeadings.js) so they can never disagree on what a heading means.
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

  let pendingEducation = null; // { degree, dateRange } awaiting an institution line
  let currentProject = null; // { name, description } being accumulated

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
  }

  for (const line of lines) {
    if (isSectionHeading(line)) {
      flushProject();
      flushEducation();
      currentSection = classifySectionHeading(line);
      continue;
    }

    if (currentSection === 'summary') {
      summaryLines.push(line);
      continue;
    }

    if (currentSection === 'education') {
      const dateMatch = line.match(DATE_RANGE_REGEX);
      if (dateMatch) {
        flushEducation(); // an unterminated prior entry — flush as-is before starting a new one
        const degree = line
          .slice(0, dateMatch.index)
          .replace(/[\s|,•\-–—]+$/, '')
          .trim();
        pendingEducation = { degree, dateRange: dateMatch[0].trim() };
      } else if (pendingEducation) {
        const split = trySplitHeaderLine(line);
        education.push({
          degree: pendingEducation.degree,
          dateRange: pendingEducation.dateRange,
          institution: split ? split.role : line,
          location: split ? split.company : '',
        });
        pendingEducation = null;
      }
      // else: a stray line with no pending entry — ignored
      continue;
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
      continue;
    }

    if (currentSection === 'skills') {
      skillsLines.push(line);
    }
    // currentSection === 'experience' or null (unrecognized heading) — ignored here,
    // WORK EXPERIENCE is handled by segmentResume() instead.
  }

  flushProject();
  flushEducation();

  const skills = skillsLines
    .join(' ')
    .split(',')
    .map((skill) => skill.trim())
    .filter(Boolean);

  return {
    summary: summaryLines.join(' ').trim(),
    education,
    projects,
    skills,
  };
}
