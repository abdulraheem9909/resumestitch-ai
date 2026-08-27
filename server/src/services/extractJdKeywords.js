import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';

const jdKeywordsSchema = z.object({
  skills: z
    .array(z.string())
    .describe(
      'Concrete technical skills required or preferred by the JD: programming languages, frameworks, ' +
        'libraries, databases, and named methodologies/practices (e.g. "TDD", "microservices"). ' +
        'Exclude soft skills, leadership/process language, and generic descriptions (e.g. "problem-solving", ' +
        '"agile environments", "high-quality code", "communication skills", "cross-functional collaboration", ' +
        '"software development principles", "full stack", "backend"). Only capture the concrete, ' +
        'individually-nameable technology or practice — not the sentence describing it.'
    ),
  tools: z
    .array(z.string())
    .describe(
      'Named tools, platforms, or products explicitly mentioned (e.g. AWS, Docker, Jira, Figma). ' +
        'Exclude generic categories that are not a specific named product (e.g. "cloud provider", "database").'
    ),
  seniority: z
    .string()
    .describe(
      'The seniority level as stated or clearly implied by the JD (e.g. "senior", "3-5 years", "entry-level"). ' +
        'Return an empty string if not indicated.'
    ),
});

const model = new ChatOpenAI({ model: 'gpt-4o-mini', temperature: 0 }).withStructuredOutput(jdKeywordsSchema, {
  name: 'extract_jd_keywords',
  strict: true,
});

/**
 * Structured-output extraction of required skills, tools, and seniority
 * signals from a pasted JD, per section 4 node 1 — never inferred beyond
 * what the text states.
 */
export async function extractJdKeywords(jdText) {
  return model.invoke([
    {
      role: 'system',
      content:
        'Extract structured information from the job description, per the schema. ' +
        'Only include items explicitly stated or clearly implied in the text — never infer or ' +
        'add anything not present. For skills and tools, include only concrete, individually-nameable ' +
        'technologies, languages, frameworks, or named products — never soft skills, leadership qualities, ' +
        'or generic process/activity phrases (e.g. "problem-solving", "agile environments", "high-quality ' +
        'code", "communication skills", "full stack", "backend"). If a JD is light on named technology and ' +
        'heavy on this kind of language, it is correct to return short or empty skills/tools arrays rather ' +
        'than filling them with generic phrases. Return empty arrays/empty string for any category not indicated.',
    },
    { role: 'user', content: jdText },
  ]);
}
