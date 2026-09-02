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
});

const model = new ChatOpenAI({ model: 'gpt-4o-mini', temperature: 0 }).withStructuredOutput(sectionsSchema, {
  name: 'segment_resume_sections',
  strict: true,
});

/**
 * Fallback only — used by resumes.js when the deterministic segmentResumeSections()
 * (segmentResumeSections.js) comes back looking broken for one or more fields:
 * education or skills empty, or summary suspiciously long (a sign it swallowed
 * other sections' content). Happens on PDFs whose layout scrambles section
 * boundaries — e.g. several headings extracted consecutively with no content
 * between them, ahead of all their actual content, from a multi-column
 * layout. Never invents content: only asked to identify and copy out what's
 * already in the text, same as segmentResumeWithAI.js's job/bullet fallback.
 */
export async function segmentResumeSectionsWithAI(bulletedText) {
  return model.invoke([
    {
      role: 'system',
      content:
        "You are given the raw extracted text of someone's resume. Extraction artifacts (headings and their " +
        'content appearing out of order, sections bleeding into each other) are expected and normal. Extract ' +
        'exactly three things:\n' +
        '1. summary — only the sentences of the professional summary/objective paragraph itself, word-for-word. ' +
        "Exclude the candidate's name, job title/headline, location/address, phone, email, and any website/" +
        'LinkedIn URL, even if one of those lines sits directly next to the summary with no blank line between ' +
        "them — and exclude headings or any other section's content. Empty string if there is no such paragraph.\n" +
        '2. education — each degree/qualification, with its institution, location, and date range. Leave ' +
        'location empty if no genuine place name is stated — never a stray leftover dash or other punctuation ' +
        'from the extraction.\n' +
        '3. skills — each individual skill or competency listed in a Skills/Core Skills section, as separate items.\n' +
        'Copy all text verbatim from the source — never rewrite, correct, summarize, or invent anything not already present.',
    },
    { role: 'user', content: bulletedText },
  ]);
}
