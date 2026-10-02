import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';
import { buildOutreachEmailMessages } from './outreachEmailPrompt.js';

const OUTREACH_EMAIL_MODEL = 'gpt-4o-mini';

const outreachEmailSchema = z.object({
  subject: z.string().describe('A short, specific email subject line, under 80 characters.'),
  body: z
    .string()
    .describe(
      'The full email body: short and direct (roughly 80-130 words, at most 2 short paragraphs, no bulleted ' +
        'list), mentioning one or two concrete accomplishments woven into a sentence, a direct ask, one closing ' +
        "line, and a sign-off — with the candidate's real name/phone/LinkedIn when a resume is linked, " +
        'otherwise a bare sign-off with no name.'
    ),
});

const model = new ChatOpenAI({ model: OUTREACH_EMAIL_MODEL, temperature: 0.3 }).withStructuredOutput(
  outreachEmailSchema,
  { name: 'generate_outreach_email', strict: true }
);

export async function generateOutreachEmail({ goal, referralRole, companyName, companyNotes, contact, resume }) {
  const messages = buildOutreachEmailMessages({ goal, referralRole, companyName, companyNotes, contact, resume });
  const result = await model.invoke(messages);
  return { subject: result.subject, body: result.body };
}
