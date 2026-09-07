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
        'and neither should e.g. "SQL" and "PostgreSQL" (one is a general query language, the other one ' +
        'specific database product), or "Docker" and "Kubernetes" (related but different tools).\n\n' +
        'A missed grouping only means two spellings of the same skill stay listed separately — mildly ' +
        'annoying, not harmful. A wrong grouping can make it look like someone has real experience with ' +
        'something they have never actually used. Because of that asymmetry, when you are not fully ' +
        'confident two terms are truthfully the exact same skill, give each its own separate group rather ' +
        'than guessing they belong together.\n\n' +
        'Every input term must end up as an alias in exactly one group.',
    },
    { role: 'user', content: newTerms.join('\n') },
  ]);
}

const NO_MATCH = '__none__';

/**
 * Per-JD, not resume-upload (see gapAnalysisNode in jobAgentGraph.js). Given a
 * list of JD skill terms that didn't canonically match anything on the
 * resume, and the resume's own already-confirmed canonical skill ids, checks
 * whether any unresolved term is truthfully just a different spelling of one
 * of those already-confirmed skills (e.g. a JD saying "ReactJS" against a
 * resume already confirmed to have "react").
 *
 * Deliberately a narrower, closed-choice task than proposeSkillAliasGroups
 * above: for each term the model may only pick one of the *given* confirmed
 * ids or "no match" — via a dynamically-built z.enum, so the model
 * structurally cannot invent a new id or misspell an existing one, unlike
 * the open-ended grouping task. This is intentionally the more constrained
 * of the two calls, since a wrong answer here directly turns a genuine gap
 * into a false "already covered" credit.
 */
export async function matchUnresolvedSkillsToKnown(unresolvedTerms, knownSkillIds) {
  if (!unresolvedTerms?.length || !knownSkillIds?.length) return [];

  const matchSchema = z.object({
    matches: z.array(
      z.object({
        term: z.string().describe('One of the given unresolved terms, verbatim.'),
        matchesCanonicalId: z
          .enum([...knownSkillIds, NO_MATCH])
          .describe(
            `One of the given confirmed skill ids if this term truthfully names the exact same real-world ` +
              `skill under different wording — not merely related, complementary, or in the same general ` +
              `category. "${NO_MATCH}" if genuinely uncertain or different.`
          ),
      })
    ),
  });
  const model = new ChatOpenAI({ model: 'gpt-4o-mini', temperature: 0 }).withStructuredOutput(matchSchema, {
    name: 'match_unresolved_skills',
    strict: true,
  });

  const result = await model.invoke([
    {
      role: 'system',
      content:
        'You will be given a list of unresolved skill/technology terms from a job description, and a separate ' +
        'list of skill ids already confirmed present on a candidate\'s resume. For each unresolved term, decide ' +
        'whether it names the exact same real-world skill as one of the confirmed ids, just written differently ' +
        '(e.g. "ReactJS" is the same skill as "react"; "NodeJS" is the same skill as "node.js"). Do not match ' +
        'merely related, complementary, or same-category skills — e.g. "SQL" is not the same as "postgresql" ' +
        '(a general query language vs. one specific database product), and "docker" is not the same as ' +
        `"kubernetes" (related but different tools). A missed match only leaves an honest gap in place — ` +
        'mildly conservative, not harmful. A wrong match puts an unearned claim on someone\'s resume. Because ' +
        `of that asymmetry, answer "${NO_MATCH}" whenever you are not fully confident, rather than guessing.`,
    },
    {
      role: 'user',
      content:
        `<unresolved_terms>\n${unresolvedTerms.join('\n')}\n</unresolved_terms>\n\n` +
        `<confirmed_resume_skills>\n${knownSkillIds.join('\n')}\n</confirmed_resume_skills>`,
    },
  ]);

  return result.matches
    .filter((match) => match.matchesCanonicalId !== NO_MATCH)
    .map((match) => ({ term: match.term, matchesCanonicalId: match.matchesCanonicalId }));
}
