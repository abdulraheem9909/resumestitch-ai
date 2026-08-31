import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';

const tagSchema = z.object({
  skills: z
    .array(z.string())
    .describe(
      'Concrete technical skills only: programming languages, frameworks, libraries, databases, ' +
        'cloud/infra platforms, named tools/products, and named methodologies/practices/techniques ' +
        '(e.g. "RAG", "RBAC", "TDD", "microservices") explicitly mentioned. ' +
        'Exclude soft skills, job activities, and generic descriptions (e.g. "mentoring", "code reviews", ' +
        '"architecture design", "UI responsiveness", "cross-functional collaboration").'
    ),
  metrics: z
    .array(z.string())
    .describe(
      'Only quantifiable results explicitly stated in the text: a number, percentage, count, currency amount, ' +
        'or time span (e.g. "50%", "5+ modules", "40% increase"). ' +
        'Return an empty array if the bullet contains no such quantifiable result — never restate ' +
        'non-numeric phrases from the bullet as if they were metrics.'
    ),
});

const model = new ChatOpenAI({ model: 'gpt-4o-mini', temperature: 0 }).withStructuredOutput(tagSchema, {
  name: 'tag_bullet',
  strict: true,
});

/**
 * One structured-output call per resume bullet, extracting only what's
 * explicitly stated in that line — never inferred (section 2.1, step 4).
 */
export async function tagBullet(bulletText) {
  return model.invoke([
    {
      role: 'system',
      content:
        'Extract two things from the given resume bullet, per the schema:\n' +
        '1. skills — concrete technical skills only (languages, frameworks, libraries, databases, cloud/infra ' +
        'platforms, named tools/products, and named methodologies/practices/techniques such as "RAG", "RBAC", ' +
        '"TDD", "microservices"). Do not include soft skills, activities, or generic descriptions ' +
        '(e.g. "mentoring", "code reviews", "architecture design", "UI responsiveness").\n' +
        '2. metrics — only quantifiable results (a number, percentage, count, currency amount, or time span). ' +
        'If the bullet has no quantifiable result, return an empty array for metrics rather than restating ' +
        'other phrases from the text.\n' +
        'Only include items explicitly stated in the text — never infer or add anything not present.',
    },
    { role: 'user', content: bulletText },
  ]);
}
