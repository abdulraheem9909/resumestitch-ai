export function matchedSkills(jdCanonicalSkills, resumeCanonicalSkills) {
  const resumeSet = new Set(resumeCanonicalSkills || []);
  return (jdCanonicalSkills || []).filter((skill) => resumeSet.has(skill));
}
