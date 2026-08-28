import { createJobAgentGraph } from './jobAgentGraph.js';

// createJobAgentGraph() opens its own native MongoClient for the
// checkpointer — fine for a one-shot script (which closes it when done),
// wrong to repeat per HTTP request. Created once at server startup, never
// closed for the life of the process.
let instance = null;

export function initJobAgentGraph(mongoUri, dbName) {
  if (instance) return instance;
  instance = createJobAgentGraph(mongoUri, dbName);
  return instance;
}

export function getJobAgentGraph() {
  if (!instance) {
    throw new Error('Job agent graph not initialized — call initJobAgentGraph() at server startup.');
  }
  return instance.graph;
}

export function getCheckpointer() {
  if (!instance) {
    throw new Error('Job agent graph not initialized — call initJobAgentGraph() at server startup.');
  }
  return instance.checkpointer;
}
