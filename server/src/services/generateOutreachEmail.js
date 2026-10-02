import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';
import { buildOutreachEmailMessages } from './outreachEmailPrompt.js';

const OUTREACH_EMAIL_MODEL = 'gpt-4o-mini';

const outreachEmailSchema = z.object({
  subject: z.string().describe('A short, specific email subject line, under 80 characters.'),
  body: z.string().describe('The full email body, at most 3 short paragraphs, no address block or signature scaffolding.'),
});

const model = new ChatOpenAI({ model: OUTREACH_EMAIL_MODEL, temperature: 0.3 }).withStructuredOutput(
  outreachEmailSchema,
  { name: 'generate_outreach_email', strict: true }
);

export async function generateOutreachEmail({ goal, referralRole, companyName, contact, resume }) {
  const messages = buildOutreachEmailMessages({ goal, referralRole, companyName, contact, resume });
  const result = await model.invoke(messages);
  return { subject: result.subject, body: result.body };
}
