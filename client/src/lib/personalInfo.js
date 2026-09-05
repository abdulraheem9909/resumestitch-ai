// Shared between the upload dialog (MasterResumes.jsx) and the "Edit
// details" section (ResumeDetail.jsx) so the same fields are required in
// both places — LinkedIn/Portfolio stay optional in both, since plenty of
// real candidates genuinely don't have either.
export const REQUIRED_PERSONAL_INFO_FIELDS = ["fullName", "title", "location", "phone", "email"];

export function isPersonalInfoValid(personalInfo) {
  return REQUIRED_PERSONAL_INFO_FIELDS.every((field) => (personalInfo?.[field] || "").trim());
}
