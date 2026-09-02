const EXPERIENCE_NAMES = new Set([
  'WORKEXPERIENCE',
  'EXPERIENCE',
  'EMPLOYMENTHISTORY',
  'PROFESSIONALEXPERIENCE',
  'OTHEREXPERIENCE',
  'ADDITIONALEXPERIENCE',
]);
const SUMMARY_NAMES = new Set([
  'SUMMARY',
  'PROFESSIONALSUMMARY',
  'PROFILE',
  'OBJECTIVE',
  'CAREERSUMMARY',
  'ABOUT',
]);
const EDUCATION_NAMES = new Set(['EDUCATION', 'EDUCATIONANDTRAINING', 'ACADEMICBACKGROUND']);
const PROJECTS_NAMES = new Set(['PROJECTS', 'PROJECTEXPERIENCE', 'KEYPROJECTS', 'PERSONALPROJECTS']);
const SKILLS_NAMES = new Set(['SKILLS', 'TECHNICALSKILLS', 'CORECOMPETENCIES', 'SKILLSSUMMARY', 'CORESKILLS']);

const KNOWN_HEADING_NAMES = new Set([
  ...EXPERIENCE_NAMES,
  ...SUMMARY_NAMES,
  ...EDUCATION_NAMES,
  ...PROJECTS_NAMES,
  ...SKILLS_NAMES,
]);

// A line counts as a section heading two different ways: the traditional
// shouty ALL-CAPS style (this also catches a heading this app has no specific
// category for, e.g. "CERTIFICATIONS" — its content still won't be captured,
// but at least this stops it from leaking into whatever section came before
// it), or — regardless of case — text matching one of the specific headings
// this app does recognize. "Work Experience" in Title Case describes the
// exact same section as "WORK EXPERIENCE" and is at least as common a way to
// write it; requiring shouting on top of the right words missed every
// Title-Case-headed resume entirely.
export function isSectionHeading(line) {
  const letters = line.replace(/[^A-Za-z]/g, '');
  if (letters.length === 0 || line.length > 40) return false;
  if (letters === letters.toUpperCase()) return true;
  return KNOWN_HEADING_NAMES.has(letters.toUpperCase());
}

/**
 * Classifies a heading line already confirmed by isSectionHeading(). A fixed
 * whitelist rather than fuzzy matching — an unrecognized heading (e.g.
 * "CERTIFICATIONS") returns null and its content is simply not captured,
 * rather than risking it being mis-bucketed into the wrong section.
 */
export function classifySectionHeading(line) {
  const normalized = line.replace(/[^A-Za-z]/g, '').toUpperCase();
  if (EXPERIENCE_NAMES.has(normalized)) return 'experience';
  if (SUMMARY_NAMES.has(normalized)) return 'summary';
  if (EDUCATION_NAMES.has(normalized)) return 'education';
  if (PROJECTS_NAMES.has(normalized)) return 'projects';
  if (SKILLS_NAMES.has(normalized)) return 'skills';
  return null;
}
