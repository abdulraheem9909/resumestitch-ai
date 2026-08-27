export function isSectionHeading(line) {
  const letters = line.replace(/[^A-Za-z]/g, '');
  return letters.length > 0 && letters === letters.toUpperCase() && line.length <= 40;
}

const EXPERIENCE_NAMES = new Set([
  'WORKEXPERIENCE',
  'EXPERIENCE',
  'EMPLOYMENTHISTORY',
  'PROFESSIONALEXPERIENCE',
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
const SKILLS_NAMES = new Set(['SKILLS', 'TECHNICALSKILLS', 'CORECOMPETENCIES', 'SKILLSSUMMARY']);

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
