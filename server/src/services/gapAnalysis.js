import { normalizeSkills } from './normalizeSkills.js';

export function gapAnalysis(jdCanonicalSkills, resumeCanonicalSkills) {
  const resumeSet = new Set(resumeCanonicalSkills || []);
  return (jdCanonicalSkills || []).filter((skill) => !resumeSet.has(skill));
}

/**
 * Re-derives a JD's canonical skill list from its raw, pre-canonicalization
 * `jdKeywords` (the `{ skills, tools }` shape node 1 extracts, saved on the
 * application/graph state regardless) against the CURRENT alias dictionary
 * — instead of trusting an already-canonicalized `jdCanonicalSkills`
 * snapshot, which is frozen the moment it was first computed. Found live: a
 * JD self-canonicalizes "Tailwind CSS" to the raw "tailwind css" before the
 * dictionary has ever heard of it; if the dictionary later learns a
 * different "official" spelling for that same phrase (e.g. "tailwind-css",
 * taught by a resume upload or a hand-edited bullet), the frozen snapshot
 * never finds out, so a resume that genuinely covers it keeps showing a
 * false gap forever — the two sides are comparing different spellings of
 * the identical concept. Shared by computeGapAnalysis (jobAgentGraph.js,
 * used on retries) and computeHumanRecheck (applications.js, used by
 * Re-check), so both re-derive the JD side the same way the resume side
 * already does. Falls back to trusting `fallbackJdCanonicalSkills` verbatim
 * when `jdKeywords` isn't given (an older state shape, or a caller that only
 * has the canonicalized form on hand).
 */
export function deriveJdCanonicalSkills(jdKeywords, fallbackJdCanonicalSkills, aliases) {
  if (!jdKeywords) return fallbackJdCanonicalSkills || [];
  return normalizeSkills([...(jdKeywords.skills || []), ...(jdKeywords.tools || [])], aliases || {});
}
