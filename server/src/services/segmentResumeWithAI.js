import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';

const jobsSchema = z.object({
  jobs: z.array(
    z.object({
      role: z.string(),
      company: z.string(),
      dateRange: z.string().describe('e.g. "Oct 2023 - Present". Reconstruct the actual range even if its connecting dash/word is missing or displaced in the source text.'),
      bullets: z
        .array(z.string())
        .describe(
          'Every distinct achievement/responsibility line for this job, copied verbatim from the source text — ' +
            'never rewritten, reworded, corrected, or invented. If a job\'s content is written as one paragraph ' +
            'instead of a bulleted list, split it into its individual sentences without changing any wording.'
        ),
    })
  ),
});

const model = new ChatOpenAI({ model: 'gpt-4o-mini', temperature: 0 }).withStructuredOutput(jobsSchema, {
  name: 'segment_resume_jobs',
  strict: true,
});

/**
 * Fallback only — used by resumes.js when the deterministic segmentResume()
 * (segmentResume.js) finds zero bullets. That happens when a PDF's bullet
 * glyphs don't survive text extraction, or a multi-column layout scatters a
 * job's date-range text away from the tokens it belongs to — cases with no
 * character-level signal left for a regex to key off of. Never invents
 * content: only identifies where job/bullet boundaries are in text that's
 * already been extracted verbatim from the document.
 */
export async function segmentResumeWithAI(bulletedText) {
  const { jobs } = await model.invoke([
    {
      role: 'system',
      content:
        "You are given the raw extracted text of someone's resume. Extraction artifacts are expected and " +
        'normal — e.g. a stray "-" on its own line, or two dates with no separator between them because a ' +
        "multi-column layout scattered the connecting dash elsewhere. Identify every work-experience job entry " +
        "and, for each one, its role, company, date range, and every distinct achievement/responsibility line. " +
        'Include every job you find, with equal thoroughness — a brief or less-relevant role listed under a ' +
        'secondary heading (e.g. "Other Experience", "Additional Experience") is just as much a job entry as ' +
        "one under \"Work Experience\", and a job described in a single plain sentence with no bullet points at " +
        'all still counts and must still be included, with that sentence as its one bullet. Do not skip a job ' +
        'just because it has less content than the others.\n' +
        'Copy bullet text verbatim from the source — never rewrite, correct, summarize, or add anything not ' +
        "already present. If a job's content is written as one paragraph instead of a bulleted list, split it " +
        'into its individual sentences without changing any wording.',
    },
    { role: 'user', content: bulletedText },
  ]);

  return jobs.flatMap((job) =>
    job.bullets.map((text) => ({
      text,
      role: job.role || '',
      company: job.company || '',
      dateRange: job.dateRange || '',
    }))
  );
}
