import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';

const sectionsSchema = z.object({
  summary: z
    .string()
    .describe(
      'Only the sentences of the professional summary/objective paragraph itself, word-for-word. Exclude the ' +
        "candidate's name, job title/headline, location or address, phone, email, and any website/LinkedIn URL " +
        "even if one of those lines sits directly next to the summary with no blank line between them — and " +
        "exclude headings or any other section's content. Empty string if there is no such paragraph."
    ),
  education: z.array(
    z.object({
      degree: z.string(),
      institution: z.string(),
      location: z.string().describe('A real place name, e.g. "Manchester, UK" — empty string if no genuine location is stated (never a stray leftover dash or other punctuation).'),
      dateRange: z.string(),
    })
  ),
  skills: z
    .array(z.string())
    .describe('Each individual skill/competency listed in a Skills (or Core Skills) section, as separate items — never merged together into one string.'),
  certifications: z.array(
    z.object({
      name: z.string(),
      issuer: z.string().describe('Empty string if no issuing organization is stated.'),
      date: z.string().describe('Empty string if no date is stated.'),
    })
  ),
  volunteerWork: z.array(
    z.object({
      role: z.string(),
      organization: z.string(),
      dateRange: z.string().describe('Empty string if no date range is stated.'),
      description: z.string().describe('Empty string if no description is stated.'),
    })
  ),
});

const model = new ChatOpenAI({ model: 'gpt-4o-mini', temperature: 0 }).withStructuredOutput(sectionsSchema, {
  name: 'segment_resume_sections',
  strict: true,
});

/**
 * Fallback only — used by resumes.js when the deterministic segmentResumeSections()
 * (segmentResumeSections.js) comes back looking broken for one or more fields:
 * education, skills, certifications, or volunteerWork empty/suspect, or summary
 * suspiciously long (a sign it swallowed other sections' content). Happens on
 * PDFs whose layout scrambles section boundaries — e.g. several headings
 * extracted consecutively with no content between them, ahead of all their
 * actual content, from a multi-column layout (the deterministic pass has no
 * way to know which of several stacked headings a given line of content
 * really belongs to, and simply attributes everything to whichever heading
 * it saw most recently). Never invents content: only asked to identify and
 * copy out what's already in the text, same as segmentResumeWithAI.js's
 * job/bullet fallback.
 */
export async function segmentResumeSectionsWithAI(bulletedText) {
  return model.invoke([
    {
      role: 'system',
      content:
        "You are given the raw extracted text of someone's resume. Extraction artifacts (headings and their " +
        'content appearing out of order, sections bleeding into each other) are expected and normal. Extract ' +
        'exactly five things:\n' +
        '1. summary — only the sentences of the professional summary/objective paragraph itself, word-for-word. ' +
        "Exclude the candidate's name, job title/headline, location/address, phone, email, and any website/" +
        'LinkedIn URL, even if one of those lines sits directly next to the summary with no blank line between ' +
        "them — and exclude headings or any other section's content. Empty string if there is no such paragraph.\n" +
        '2. education — each degree/qualification, with its institution, location, and date range. Leave ' +
        'location empty if no genuine place name is stated — never a stray leftover dash or other punctuation ' +
        'from the extraction.\n' +
        '3. skills — each individual skill or competency listed in a Skills/Core Skills section, as separate items.\n' +
        '4. certifications — each certification or course, with its issuing organization and date if stated. A ' +
        'single certification is often split across several consecutive lines (e.g. its title, then its issuer, ' +
        'then its date, each on their own line) — merge those into one entry, never one per line.\n' +
        '5. volunteerWork — each volunteer role, with its organization, date range, and description if stated. ' +
        'Empty array if the resume has no volunteer section at all.\n' +
        'A resume section can be genuinely absent — return an empty array/string for it rather than inventing ' +
        "content, and never let one section's content bleed into another just because their headings sat next " +
        'to each other in the extracted text. ' +
        'Copy all text verbatim from the source — never rewrite, correct, summarize, or invent anything not already present.',
    },
    { role: 'user', content: bulletedText },
  ]);
}
