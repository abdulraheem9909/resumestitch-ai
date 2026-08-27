import { StateGraph, StateSchema, START, END } from '@langchain/langgraph';
import { MongoDBSaver } from '@langchain/langgraph-checkpoint-mongodb';
import { MongoClient } from 'mongodb';
import { z } from 'zod';
import { extractJdKeywords } from '../services/extractJdKeywords.js';
import { normalizeSkills } from '../services/normalizeSkills.js';
import { gapAnalysis } from '../services/gapAnalysis.js';
import { roleFitGate } from '../services/roleFitGate.js';

const JobAgentState = new StateSchema({
  jdText: z.string(),
  resumeSummary: z.string().optional(),
  resumeTitle: z.string().optional(),
  resumeCanonicalSkills: z.array(z.string()).default(() => []),
  jdKeywords: z
    .object({
      skills: z.array(z.string()),
      tools: z.array(z.string()),
      seniority: z.string(),
    })
    .optional(),
  jdCanonicalSkills: z.array(z.string()).optional(),
  keywordGaps: z.array(z.string()).optional(),
  roleFit: z
    .object({
      fit: z.enum(['plausible', 'low']),
      reason: z.string(),
    })
    .optional(),
});

// Node 1 (section 4)
async function extractJdKeywordsNode(state) {
  const jdKeywords = await extractJdKeywords(state.jdText);
  return { jdKeywords };
}

// Node 2 (section 4)
function normalizeSkillsNode(state) {
  const jdCanonicalSkills = normalizeSkills([...state.jdKeywords.skills, ...state.jdKeywords.tools]);
  return { jdCanonicalSkills };
}

// Node 3 (section 4)
function gapAnalysisNode(state) {
  const keywordGaps = gapAnalysis(state.jdCanonicalSkills, state.resumeCanonicalSkills);
  return { keywordGaps };
}

// Node 4 (section 5a)
async function roleFitGateNode(state) {
  const roleFit = await roleFitGate({
    jdText: state.jdText,
    jdCanonicalSkills: state.jdCanonicalSkills,
    resumeCanonicalSkills: state.resumeCanonicalSkills,
    resumeSummary: state.resumeSummary,
    resumeTitle: state.resumeTitle,
  });
  return { roleFit };
}

/**
 * Assembles nodes 1-4 (section 4) into a LangGraph StateGraph with a
 * MongoDB-backed checkpointer. Both branches of node 4's conditional edge
 * route to END for now — node 5 (tailoring) and node 10 (human approval,
 * for role_mismatch) don't exist yet. Redirecting them later only requires
 * changing the path map below, not the router function.
 */
export function createJobAgentGraph(mongoUri, dbName) {
  const client = new MongoClient(mongoUri);
  const checkpointer = new MongoDBSaver(dbName ? { client, dbName } : { client });

  const builder = new StateGraph(JobAgentState)
    .addNode('extractJdKeywords', extractJdKeywordsNode)
    .addNode('normalizeSkills', normalizeSkillsNode)
    .addNode('gapAnalysis', gapAnalysisNode)
    .addNode('roleFitGate', roleFitGateNode)
    .addEdge(START, 'extractJdKeywords')
    .addEdge('extractJdKeywords', 'normalizeSkills')
    .addEdge('normalizeSkills', 'gapAnalysis')
    .addEdge('gapAnalysis', 'roleFitGate')
    .addConditionalEdges('roleFitGate', (state) => state.roleFit.fit, { low: END, plausible: END });

  const graph = builder.compile({ checkpointer });

  return { graph, client };
}
