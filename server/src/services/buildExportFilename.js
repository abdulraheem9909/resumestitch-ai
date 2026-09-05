// Strips everything but letters, numbers, hyphens, and underscores — some
// ATS upload handlers have trouble with spaces and other special characters
// in an uploaded filename.
function sanitizeFilenameSegment(value) {
  return (value || '').replace(/[^a-zA-Z0-9_-]/g, '');
}

// A single personalInfo.fullName field has no first/last distinction of its
// own, so the last whitespace-separated word is treated as the last name and
// everything before it is joined together as the first name — the common
// convention for splitting a single full-name string in two.
function splitFullName(fullName) {
  const words = (fullName || '').trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) {
    return { firstName: words[0] || '', lastName: '' };
  }
  return { firstName: words.slice(0, -1).join(''), lastName: words[words.length - 1] };
}

// FirstName_LastName_CompanyName_<suffix>.<extension> — built at request time
// from personalInfo.fullName/companyName, since resumeFilename stays
// intentionally unpopulated per the on-demand export design
// (key-decisions-log.md). companyName is optional — a master-resume export
// (no application context) omits it and still produces a clean filename.
export function buildExportFilename({ fullName, companyName, suffix, extension = 'docx' }) {
  const { firstName, lastName } = splitFullName(fullName);
  const segments = [firstName, lastName, companyName, suffix].map(sanitizeFilenameSegment).filter(Boolean);
  return `${segments.join('_') || 'application'}.${extension}`;
}
