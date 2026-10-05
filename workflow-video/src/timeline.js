// Pure timeline data — no DOM. Shared by the browser page (scenes.js) and
// the Node render script, so frame count / duration can never drift apart.
export const FPS = 30;

export const T = {
  title: [0, 4.5],
  parts: [4.5, 11.0],
  resumeSetup: [11.0, 17.5],
  jdSubmit: [17.5, 24.0],
  pipeline: [24.0, 92.0],
  exportScene: [92.0, 98.0],
  outreach: [98.0, 105.5],
  guardrails: [105.5, 114.0],
  outro: [114.0, 119.0],
};

export const DURATION = T.outro[1];
export const TOTAL_FRAMES = Math.round(DURATION * FPS);

// Local offsets (seconds) within the pipeline scene.
export const PL = {
  railIntro: [0, 3.5],
  node1: [3.5, 9.0],
  node2: [9.0, 14.5],
  node3: [14.5, 20.0],
  node4: [20.0, 26.5],
  node5: [26.5, 32.0],
  node6: [32.0, 37.5],
  node7: [37.5, 43.0],
  node8: [43.0, 48.5],
  node9: [48.5, 55.0],
  node10: [55.0, 61.5],
  retryPolicy: [61.5, 68.0],
};

export const NODE_KEYS = ['node1', 'node2', 'node3', 'node4', 'node5', 'node6', 'node7', 'node8', 'node9', 'node10'];
