import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';

const skillAliasSchema = z.object({
  groups: z.array(
    z.object({
      canonicalId: z.string().describe('A short, lowercase, machine-friendly id for this one skill, e.g. "flutter", "node.js", "rest-api".'),
      aliases: z
        .array(z.string())
        .describe(
          'Every common surface form for this exact skill — abbreviations, alternate spellings, ' +
            'with/without punctuation, etc. Must include the given input terms that belong to this group, ' +
            'plus any other well-known alternate names for the same skill.'
        ),
    })
  ),
});

const model = new ChatOpenAI({ model: 'gpt-4o-mini', temperature: 0 }).withStructuredOutput(skillAliasSchema, {
  name: 'propose_skill_aliases',
  strict: true,
});

/**
 * Resume-upload-time only (see resumes.js) — never called per-JD. Given a
 * list of skill terms not yet in the dictionary (server/data/skillAliases.json,
 * via skillAliasesStore.js), asks the model to group any that refer to the
 * exact same skill under one canonical id, and to round out each group with
 * other common surface forms beyond just what was given.
 */
export async function proposeSkillAliasGroups(newTerms) {
  if (!newTerms || newTerms.length === 0) return { groups: [] };

  return model.invoke([
    {
      role: 'system',
      content:
        'You will be given a list of skill/technology terms extracted from someone\'s resume. Group any ' +
        'terms that refer to the exact same skill under one canonical id each, per the schema. For each group, ' +
        'list every common way that skill might be written or abbreviated — not just the input terms, but any ' +
        'other well-known alternate spelling too (e.g. given "NodeJS", a group for it should also include ' +
        '"node" and "node.js" even if those exact strings weren\'t given).\n\n' +
        'Never merge two genuinely different skills into the same group, even if closely related — ' +
        'for example "React" and "React Native" are different skills and must never share a group, ' +
        'and neither should e.g. "SQL" and "PostgreSQL".\n\n' +
        'Every input term must end up as an alias in exactly one group.',
    },
    { role: 'user', content: newTerms.join('\n') },
  ]);
}
