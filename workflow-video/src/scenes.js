import { T, PL, NODE_KEYS } from './timeline.js';
import { SAMPLE, SAMPLE_NOTE } from './data.js';

const stage = document.getElementById('stage');

// ---------------------------------------------------------------- helpers --

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

function svgEl(tag, attrs) {
  const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}

function animate(target, keyframes, opts) {
  const a = target.animate(keyframes, { fill: 'both', easing: 'cubic-bezier(.22,.7,.2,1)', ...opts });
  a.pause();
  a.currentTime = 0;
  return a;
}

function addBrand(root) {
  const b = el('div', 'brand');
  b.appendChild(el('div', 'mark'));
  b.appendChild(el('div', 'name', 'ResumeStitch AI'));
  root.appendChild(b);
  return b;
}

function addNote(root) {
  root.appendChild(el('div', 'note', SAMPLE_NOTE));
}

// ------------------------------------------------------------- components --

function chipsRow(container, items, opts = {}) {
  const row = el('div');
  row.style.display = 'flex';
  row.style.flexWrap = 'wrap';
  row.style.gap = '14px';
  if (opts.justify) row.style.justifyContent = opts.justify;
  items.forEach((it) => {
    const c = el('span', `chip${it.variant ? ' ' + it.variant : ''}`, it.text);
    row.appendChild(c);
  });
  container.appendChild(row);
  return row;
}

function labeledChips(container, label, items) {
  const wrap = el('div');
  wrap.style.marginBottom = '26px';
  wrap.appendChild(el('div', 'eyebrow', label));
  const spacer = el('div');
  spacer.style.height = '14px';
  wrap.appendChild(spacer);
  chipsRow(wrap, items);
  container.appendChild(wrap);
  return wrap;
}

function arrowDivider(container, text) {
  const d = el('div', null, `&darr;&nbsp; ${text}`);
  d.style.margin = '18px 0';
  d.style.fontFamily = "'JetBrains Mono', monospace";
  d.style.fontSize = '22px';
  d.style.color = 'var(--text-secondary)';
  container.appendChild(d);
  return d;
}

function twoColumn(container, left, right) {
  const row = el('div');
  row.style.display = 'flex';
  row.style.gap = '48px';
  row.style.width = '100%';
  const l = el('div');
  l.style.flex = '1';
  const r = el('div');
  r.style.flex = '1';
  left(l);
  right(r);
  row.appendChild(l);
  row.appendChild(r);
  container.appendChild(row);
  return row;
}

function meter(container, pct, markerPct, label) {
  const wrap = el('div');
  wrap.style.width = '100%';
  const track = el('div');
  track.style.position = 'relative';
  track.style.height = '26px';
  track.style.borderRadius = '13px';
  track.style.background = 'rgba(163,174,203,0.18)';
  track.style.border = '2px dashed var(--panel-border)';
  track.style.overflow = 'hidden';
  const fill = el('div');
  fill.style.position = 'absolute';
  fill.style.left = '0';
  fill.style.top = '0';
  fill.style.bottom = '0';
  fill.style.width = pct + '%';
  fill.style.background = 'var(--accent)';
  fill.style.opacity = '0.85';
  track.appendChild(fill);
  const marker = el('div');
  marker.style.position = 'absolute';
  marker.style.left = markerPct + '%';
  marker.style.top = '-8px';
  marker.style.bottom = '-8px';
  marker.style.width = '3px';
  marker.style.background = 'var(--text)';
  track.appendChild(marker);
  wrap.appendChild(track);
  const cap = el('div', null, label);
  cap.style.marginTop = '14px';
  cap.style.fontFamily = "'JetBrains Mono', monospace";
  cap.style.fontSize = '22px';
  cap.style.color = 'var(--text-secondary)';
  wrap.appendChild(cap);
  container.appendChild(wrap);
  return wrap;
}

function beforeAfterText(container, before, after) {
  const mk = (label, text) => {
    const w = el('div', 'panel');
    w.style.marginBottom = '20px';
    w.style.padding = '22px 26px';
    const lab = el('div', 'eyebrow', label);
    lab.style.marginBottom = '10px';
    w.appendChild(lab);
    const t = el('div', null, text);
    t.style.fontSize = '26px';
    t.style.lineHeight = '1.4';
    t.style.color = 'var(--text)';
    w.appendChild(t);
    return w;
  };
  container.appendChild(mk('BEFORE', before));
  container.appendChild(mk('AFTER', after));
}

function claimCheck(container, claim, source) {
  const row = el('div');
  row.style.display = 'flex';
  row.style.alignItems = 'center';
  row.style.gap = '20px';
  row.style.marginBottom = '22px';
  const chip = el('span', 'chip accent', claim);
  row.appendChild(chip);
  const arrow = el('span', null, '&rarr;');
  arrow.style.fontSize = '30px';
  arrow.style.color = 'var(--text-secondary)';
  row.appendChild(arrow);
  const check = el('span', null, '&#10003; verified');
  check.style.fontSize = '24px';
  check.style.color = 'var(--accent)';
  check.style.fontWeight = '700';
  row.appendChild(check);
  container.appendChild(row);
  const src = el('div', 'mono', source);
  src.style.fontSize = '22px';
  src.style.color = 'var(--text-secondary)';
  src.style.fontStyle = 'italic';
  container.appendChild(src);
}

function toggleIllustration(container, onLabel, offLabel) {
  const row = el('div');
  row.style.display = 'flex';
  row.style.flexDirection = 'column';
  row.style.gap = '18px';
  const mk = (text, active) => {
    const r = el('div');
    r.style.display = 'flex';
    r.style.alignItems = 'center';
    r.style.gap = '18px';
    const dot = el('span');
    dot.style.width = '20px';
    dot.style.height = '20px';
    dot.style.borderRadius = '50%';
    dot.style.border = '3px solid ' + (active ? 'var(--accent)' : 'var(--panel-border)');
    dot.style.background = active ? 'var(--accent)' : 'transparent';
    r.appendChild(dot);
    const t = el('span', null, text);
    t.style.fontSize = '26px';
    t.style.color = active ? 'var(--text)' : 'var(--text-secondary)';
    t.style.fontWeight = active ? '700' : '500';
    r.appendChild(t);
    return r;
  };
  row.appendChild(mk(onLabel, true));
  row.appendChild(mk(offLabel, false));
  container.appendChild(row);
}

function scoreGauge(container, score, flags) {
  const row = el('div');
  row.style.display = 'flex';
  row.style.alignItems = 'center';
  row.style.gap = '34px';
  row.style.marginBottom = '26px';
  const ring = el('div');
  ring.style.width = '140px';
  ring.style.height = '140px';
  ring.style.borderRadius = '50%';
  ring.style.border = '10px solid var(--accent)';
  ring.style.display = 'flex';
  ring.style.alignItems = 'center';
  ring.style.justifyContent = 'center';
  ring.style.fontSize = '44px';
  ring.style.fontWeight = '800';
  ring.textContent = String(score);
  row.appendChild(ring);
  const lab = el('div', 'eyebrow', 'ATS SCORE (ILLUSTRATIVE)');
  row.appendChild(lab);
  container.appendChild(row);
  const chips = flags.map((f) => ({ text: f.text, variant: f.active ? 'danger' : 'muted' }));
  chipsRow(container, chips);
}

function buttonsRow(container, items) {
  const row = el('div');
  row.style.display = 'flex';
  row.style.flexWrap = 'wrap';
  row.style.gap = '18px';
  items.forEach((it) => {
    const b = el('div', null, it.text);
    b.style.padding = '18px 28px';
    b.style.borderRadius = '12px';
    b.style.fontSize = '26px';
    b.style.fontWeight = '700';
    if (it.variant === 'accent') {
      b.style.background = 'var(--accent)';
      b.style.color = '#1D2A4D';
    } else {
      b.style.border = '2px dashed var(--panel-border)';
      b.style.color = 'var(--text-secondary)';
    }
    row.appendChild(b);
  });
  container.appendChild(row);
}

function screenshot(container, src, opts = {}) {
  const img = el('img', 'screenshot');
  img.src = `assets/screens/${src}`;
  img.alt = '';
  if (opts.maxWidth) img.style.maxWidth = opts.maxWidth;
  container.appendChild(img);
  return img;
}

function tableList(container, rows) {
  const wrap = el('div');
  wrap.style.display = 'flex';
  wrap.style.flexDirection = 'column';
  wrap.style.gap = '16px';
  rows.forEach((r) => {
    const row = el('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '20px';
    const left = el('span', `chip${r.variant ? ' ' + r.variant : ''}`, r.left);
    left.style.flexShrink = '0';
    row.appendChild(left);
    const arrow = el('span', null, '&rarr;');
    arrow.style.fontSize = '24px';
    arrow.style.color = 'var(--text-secondary)';
    row.appendChild(arrow);
    const right = el('span', null, r.right);
    right.style.fontSize = '26px';
    right.style.color = 'var(--text)';
    row.appendChild(right);
    wrap.appendChild(row);
  });
  container.appendChild(wrap);
}

// ------------------------------------------------------------- scene core --

const scenes = [];

function registerScene(range, build) {
  const [start, end] = range;
  const root = el('section', 'scene');
  stage.appendChild(root);
  const ctx = { root, anims: [] };
  ctx.add = (target, kf, opts) => {
    const a = animate(target, kf, opts);
    ctx.anims.push(a);
    return a;
  };
  const api = build(ctx) || {};
  scenes.push({
    start,
    end,
    root,
    update(tLocalMs) {
      for (const a of ctx.anims) a.currentTime = Math.max(0, tLocalMs);
      if (api.update) api.update(tLocalMs);
    },
  });
}

function revealStagger(ctx, items, startMs, stepMs, opts = {}) {
  items.forEach((target, i) => {
    ctx.add(
      target,
      [
        { opacity: 0, transform: 'translateY(26px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      { duration: 560, delay: startMs + i * stepMs, ...opts }
    );
  });
}

// ===================================================== Scene 1 — Title ====

registerScene(T.title, (ctx) => {
  const r = ctx.root;
  const wrap = el('div');
  wrap.style.position = 'absolute';
  wrap.style.left = '140px';
  wrap.style.top = '0';
  wrap.style.bottom = '0';
  wrap.style.display = 'flex';
  wrap.style.flexDirection = 'column';
  wrap.style.justifyContent = 'center';
  wrap.style.gap = '28px';

  const mark = el('div');
  mark.style.width = '72px';
  mark.style.height = '72px';
  mark.style.border = '3px dashed var(--accent)';
  mark.style.borderRadius = '18px';
  mark.style.transform = 'rotate(6deg)';
  wrap.appendChild(mark);

  const h1 = el('h1', 'heading', 'ResumeStitch AI');
  h1.style.fontSize = '104px';
  wrap.appendChild(h1);

  const tag = el('p', 'body-text', 'A job-application assistant that tailors, verifies, and scores a resume per job &mdash; then waits for your approval.');
  tag.style.fontSize = '36px';
  tag.style.maxWidth = '1200px';
  wrap.appendChild(tag);

  r.appendChild(wrap);

  // Title + tagline must be legible on frame 0 (thumbnail) — animate only a
  // settle motion, never from opacity 0. Only the decorative mark fades in.
  ctx.add(mark, [{ opacity: 0.6, transform: 'rotate(-10deg) scale(0.85)' }, { opacity: 1, transform: 'rotate(6deg) scale(1)' }], { duration: 650 });
  ctx.add(h1, [{ opacity: 0.92, transform: 'translateY(10px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 550 });
  ctx.add(tag, [{ opacity: 0.92, transform: 'translateY(10px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 550, delay: 120 });
});

// ================================================ Scene 2 — Main parts ====

registerScene(T.parts, (ctx) => {
  const r = ctx.root;
  addBrand(r);

  const head = el('div');
  head.style.position = 'absolute';
  head.style.left = '140px';
  head.style.top = '150px';
  head.appendChild(el('p', 'eyebrow', 'FOUR MAIN PARTS'));
  const h = el('h2', 'heading', 'What the app is made of');
  h.style.fontSize = '58px';
  h.style.marginTop = '14px';
  head.appendChild(h);
  r.appendChild(head);
  ctx.add(head, [{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 500 });

  const parts = [
    ['Master Resumes', 'Upload, parse and edit resumes &mdash; outside the pipeline, once per resume.'],
    ['Submit a JD', 'Pick a resume, paste one job description. No batching, no queue.'],
    ['AI Pipeline', 'A LangGraph thread per JD: tailor, verify, score, then pause for approval.'],
    ['Outreach Tracker', 'Companies and contacts you email directly &mdash; a separate, lighter feature.'],
  ];

  const grid = el('div');
  grid.style.position = 'absolute';
  grid.style.left = '140px';
  grid.style.top = '380px';
  grid.style.right = '140px';
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = 'repeat(4, 1fr)';
  grid.style.gap = '32px';
  r.appendChild(grid);

  const cards = parts.map(([title, desc], i) => {
    const card = el('div', 'panel');
    card.style.padding = '34px 30px';
    card.style.minHeight = '340px';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.gap = '18px';
    const num = el('div', 'mono', '0' + (i + 1));
    num.style.fontSize = '24px';
    num.style.color = 'var(--accent)';
    card.appendChild(num);
    const t = el('div', null, title);
    t.style.fontSize = '34px';
    t.style.fontWeight = '700';
    card.appendChild(t);
    const d = el('div', null, desc);
    d.style.fontSize = '24px';
    d.style.color = 'var(--text-secondary)';
    d.style.lineHeight = '1.4';
    card.appendChild(d);
    grid.appendChild(card);
    return card;
  });

  revealStagger(ctx, cards, 300, 420);
});

// ============================================ Scene 3 — Resume setup ======

function buildStepsScene(range, eyebrow, title, steps, imageSrc) {
  registerScene(range, (ctx) => {
    const r = ctx.root;
    addBrand(r);

    const head = el('div');
    head.style.position = 'absolute';
    head.style.left = '140px';
    head.style.top = '150px';
    head.appendChild(el('p', 'eyebrow', eyebrow));
    const h = el('h2', 'heading', title);
    h.style.fontSize = '58px';
    h.style.marginTop = '14px';
    head.appendChild(h);
    r.appendChild(head);
    ctx.add(head, [{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 500 });

    const list = el('div');
    list.style.position = 'absolute';
    list.style.left = '140px';
    list.style.top = '370px';
    list.style.right = imageSrc ? '900px' : '140px';
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    list.style.gap = '26px';
    r.appendChild(list);

    if (imageSrc) {
      const imgPanel = el('div', 'panel');
      imgPanel.style.position = 'absolute';
      imgPanel.style.right = '140px';
      imgPanel.style.top = '370px';
      imgPanel.style.bottom = '110px';
      imgPanel.style.width = '700px';
      imgPanel.style.display = 'flex';
      imgPanel.style.alignItems = 'center';
      imgPanel.style.justifyContent = 'center';
      r.appendChild(imgPanel);
      screenshot(imgPanel, imageSrc);
      addNote(r);
      ctx.add(imgPanel, [{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 500, delay: 260 });
    }

    const rows = steps.map(([text, file]) => {
      const row = el('div', 'panel');
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.justifyContent = 'space-between';
      row.style.padding = '26px 34px';
      const left = el('div', null, text);
      left.style.fontSize = '30px';
      left.style.color = 'var(--text)';
      left.style.maxWidth = '1240px';
      row.appendChild(left);
      const right = el('div', 'path-mono', file);
      right.style.flexShrink = '0';
      row.appendChild(right);
      list.appendChild(row);
      return row;
    });

    revealStagger(ctx, rows, 260, 360);
  });
}

buildStepsScene(T.resumeSetup, 'BEFORE THE PIPELINE', 'Set up a master resume', [
  ['Upload a .docx/.pdf &mdash; capped at 5 active resumes.', 'routes/resumes.js'],
  ['Extract text deterministically.', 'extractResumeText.js'],
  ['Segment into bullets by rule, AI fallback if broken.', 'segmentResume.js'],
  ['Tag each bullet with skills and metrics.', 'tagBullet.js &middot; gpt-4o-mini'],
  ['Teach the skill-alias dictionary new terms.', 'generateSkillAliases.js'],
], 'resumes.png');

buildStepsScene(T.jdSubmit, 'BEFORE THE PIPELINE', 'Submit one job description', [
  ['Pick a resume, paste the JD text, name the company.', 'routes/applications.js'],
  ['Deduplicate on (resume, JD text hash).', 'jdTextHash'],
  ['Create the application, start one LangGraph thread.', 'thread_id = application._id'],
], 'jd_full.png');

// =============================================== Scene 5 — Pipeline =======

const NODES = [
  {
    key: 'node1', num: 1, name: 'Extract JD keywords', type: 'llm', model: 'gpt-4o-mini',
    file: 'graph/jobAgentGraph.js', fn: 'extractJdKeywordsNode()',
    sentence: 'Pulls required skills, tools and seniority signals out of the pasted job text.',
    illustrate(box) {
      screenshot(box, 'jd_submit.png');
    },
  },
  {
    key: 'node2', num: 2, name: 'Normalize skills', type: 'rule',
    file: 'graph/jobAgentGraph.js', fn: 'normalizeSkillsNode()',
    sentence: 'Maps every JD and resume skill onto one shared canonical spelling before anything is compared.',
    illustrate(box) {
      labeledChips(box, 'RAW RESUME SKILLS', SAMPLE.resumeSkillsRaw.slice(0, 3).map((t) => ({ text: t, variant: 'muted' })));
      arrowDivider(box, 'canonicalizeSkill()');
      labeledChips(box, 'CANONICAL FORM', SAMPLE.resumeSkillsCanonical.slice(0, 3).map((t) => ({ text: t, variant: 'accent' })));
    },
  },
  {
    key: 'node3', num: 3, name: 'Gap analysis', type: 'rule+llm', model: 'gpt-4o-mini (once/app)',
    file: 'graph/jobAgentGraph.js', fn: 'gapAnalysisNode()',
    sentence: "A set difference between JD skills and resume skills — this is what's actually missing.",
    illustrate(box) {
      screenshot(box, 'skill_freq.png');
    },
  },
  {
    key: 'node4', num: 4, name: 'Role fit gate', type: 'rule+llm', model: 'gpt-4o-mini (below 50%)',
    file: 'graph/jobAgentGraph.js', fn: 'roleFitGateNode()',
    sentence: 'Checks the JD is a plausible target before any tailoring or scoring effort is spent.',
    branch: 'plausible → continue to Tailor (5)     ·     low → skip straight to Approval (10)',
    illustrate(box) {
      meter(box, 40, 50, 'canonical overlap: 2 / 5 skills ≈ 40% — below the 50% fast-pass');
    },
  },
  {
    key: 'node5', num: 5, name: 'Tailor content', type: 'llm', model: 'gpt-4o',
    file: 'graph/jobAgentGraph.js', fn: 'tailorContentNode()',
    sentence: "Rewrites or keeps every bullet — nothing is invented beyond the candidate's own wording.",
    illustrate(box) {
      screenshot(box, 'bullet_diff.png');
    },
  },
  {
    key: 'node6', num: 6, name: 'Deterministic verification', type: 'rule',
    file: 'graph/jobAgentGraph.js', fn: 'deterministicVerificationNode()',
    sentence: 'Confirms every tailored claim actually traces back to a real source bullet.',
    illustrate(box) {
      claimCheck(box, SAMPLE.claim, SAMPLE.sourceBullet);
    },
  },
  {
    key: 'node7', num: 7, name: 'Cover letter generation', type: 'llm', model: 'gpt-4o (conditional)',
    file: 'graph/jobAgentGraph.js', fn: 'coverLetterGenerationNode()',
    sentence: 'Generates a cover letter from the same verified bullets &mdash; only if one was requested.',
    illustrate(box) {
      screenshot(box, 'cover_letter.png');
    },
  },
  {
    key: 'node8', num: 8, name: 'Style linting', type: 'rule+llm', model: 'gpt-4o-mini (ambiguous only)',
    file: 'graph/jobAgentGraph.js', fn: 'styleLintingNode()',
    sentence: 'Strips AI-sounding filler phrasing and checks formatting; escalates only unclear cases.',
    illustrate(box) {
      beforeAfterText(box, SAMPLE.lintBefore, SAMPLE.lintAfter);
    },
  },
  {
    key: 'node9', num: 9, name: 'ATS score + recruiter', type: 'llm', model: 'gpt-4o',
    file: 'graph/jobAgentGraph.js', fn: 'atsScoreAndRecruiterNode()',
    sentence: 'Scores the resume and flags missing requirements, unsupported claims, or weak rewrites.',
    branch: 'flagged → retry at Gap analysis (3), capped at 3     ·     clean / low-score-only → Approval (10)',
    illustrate(box) {
      screenshot(box, 'ats_gauge.png');
    },
  },
  {
    key: 'node10', num: 10, name: 'Human approval', type: 'human',
    file: 'graph/jobAgentGraph.js', fn: 'humanApprovalNode() — interrupt()',
    sentence: 'The run pauses here &mdash; nothing is saved until you approve, edit, or send it back.',
    branch: 'approve → done     ·     retry → Gap analysis (3)     ·     override → Tailor (5)',
    illustrate(box) {
      screenshot(box, 'approve_buttons.png');
    },
  },
];

registerScene(T.pipeline, (ctx) => {
  const r = ctx.root;
  addBrand(r);

  // ---- persistent rail -----------------------------------------------
  const railWrap = el('div');
  railWrap.style.position = 'absolute';
  railWrap.style.left = '0';
  railWrap.style.top = '150px';
  railWrap.style.width = '1920px';
  railWrap.style.height = '300px';
  r.appendChild(railWrap);

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('width', '1920');
  svg.setAttribute('height', '300');
  svg.setAttribute('viewBox', '0 0 1920 300');
  railWrap.appendChild(svg);

  const N = NODES.length;
  const xStart = 190;
  const xEnd = 1730;
  const y = 170;
  const cx = (i) => xStart + ((xEnd - xStart) / (N - 1)) * i;

  // main connecting line (stitches in as the scene plays)
  const mainLine = svgEl('path', {
    d: `M ${xStart},${y} L ${xEnd},${y}`,
    stroke: '#A3AECB', 'stroke-width': '3', fill: 'none', 'stroke-dasharray': '10 10', opacity: '0.9',
  });
  svg.appendChild(mainLine);

  // skip arc: node4 -> node10
  const skipArc = svgEl('path', {
    d: `M ${cx(3)},${y - 30} Q ${(cx(3) + cx(9)) / 2},${y - 130} ${cx(9)},${y - 30}`,
    stroke: '#F5B83D', 'stroke-width': '3', fill: 'none', 'stroke-dasharray': '9 9',
  });
  svg.appendChild(skipArc);
  const skipLabel = el('div', 'path-mono', 'skip: role mismatch → straight to Approval');
  skipLabel.style.position = 'absolute';
  skipLabel.style.left = (cx(3) - 40) + 'px';
  skipLabel.style.top = '6px';
  skipLabel.style.color = 'var(--accent)';
  railWrap.appendChild(skipLabel);

  // retry arc: node9 -> node3
  const retryArc = svgEl('path', {
    d: `M ${cx(8)},${y + 40} Q ${(cx(8) + cx(2)) / 2},${y + 150} ${cx(2)},${y + 40}`,
    stroke: '#F0635A', 'stroke-width': '3', fill: 'none', 'stroke-dasharray': '9 9',
  });
  svg.appendChild(retryArc);
  const retryLabel = el('div', 'path-mono', 'retry: flagged → back to Gap analysis (cap 3)');
  retryLabel.style.position = 'absolute';
  retryLabel.style.left = (cx(5) - 40) + 'px';
  retryLabel.style.top = '258px';
  retryLabel.style.color = 'var(--danger)';
  railWrap.appendChild(retryLabel);

  const pills = [];
  const railLabels = ['Extract JD', 'Normalize', 'Gap analysis', 'Role fit', 'Tailor', 'Verify', 'Cover letter', 'Style lint', 'ATS score', 'Approval'];
  NODES.forEach((n, i) => {
    const circle = svgEl('circle', { cx: cx(i), cy: y, r: '30', fill: '#1D2A4D', stroke: '#A3AECB', 'stroke-width': '3' });
    svg.appendChild(circle);
    const numText = svgEl('text', { x: cx(i), y: y + 9, 'text-anchor': 'middle', fill: '#F2F4F9', 'font-family': 'JetBrains Mono, monospace', 'font-size': '26', 'font-weight': '700' });
    numText.textContent = String(n.num);
    svg.appendChild(numText);

    const label = el('div', null, railLabels[i]);
    label.style.position = 'absolute';
    label.style.left = (cx(i) - 78) + 'px';
    label.style.top = (y + 48) + 'px';
    label.style.width = '156px';
    label.style.textAlign = 'center';
    label.style.fontSize = '20px';
    label.style.color = 'var(--text-secondary)';
    label.style.lineHeight = '1.25';
    railWrap.appendChild(label);

    pills.push({ circle, numText, label });
  });

  // caption under the rail for the whole pipeline scene
  const railCaption = el('div', 'path-mono', 'graph/jobAgentGraph.js — one LangGraph thread per submitted JD');
  railCaption.style.position = 'absolute';
  railCaption.style.left = '140px';
  railCaption.style.top = '470px';
  r.appendChild(railCaption);

  // ---- per-node content panels ----------------------------------------
  const contentWrap = el('div');
  contentWrap.style.position = 'absolute';
  contentWrap.style.left = '140px';
  contentWrap.style.top = '540px';
  contentWrap.style.right = '140px';
  contentWrap.style.bottom = '70px';
  r.appendChild(contentWrap);

  const nodePanels = {};

  NODES.forEach((n) => {
    const panel = el('div');
    panel.style.position = 'absolute';
    panel.style.inset = '0';
    panel.style.display = 'flex';
    panel.style.gap = '56px';
    contentWrap.appendChild(panel);
    nodePanels[n.key] = panel;

    const left = el('div');
    left.style.flex = '0 0 760px';
    left.style.display = 'flex';
    left.style.flexDirection = 'column';
    left.style.gap = '16px';
    panel.appendChild(left);

    left.appendChild(el('div', 'eyebrow', `STAGE ${n.num} OF 10`));
    const h = el('div', null, n.name);
    h.style.fontSize = '50px';
    h.style.fontWeight = '800';
    left.appendChild(h);

    const badgeRow = el('div');
    badgeRow.style.display = 'flex';
    badgeRow.style.gap = '12px';
    badgeRow.style.alignItems = 'center';
    const typeLabel = n.type === 'llm' ? 'LLM call' : n.type === 'human' ? 'Human action' : n.type === 'rule+llm' ? 'Rule + LLM' : 'Rule-based';
    const typeCls = n.type === 'human' ? 'human' : n.type === 'rule' ? 'rule' : 'llm';
    badgeRow.appendChild(el('span', `badge ${typeCls}`, typeLabel));
    if (n.model) badgeRow.appendChild(el('span', 'chip mono', n.model));
    left.appendChild(badgeRow);

    const sentence = el('div', 'body-text', n.sentence);
    sentence.style.fontSize = '30px';
    left.appendChild(sentence);

    if (n.branch) {
      const b = el('div', 'path-mono', n.branch);
      b.style.fontSize = '20px';
      b.style.color = 'var(--accent)';
      b.style.marginTop = '4px';
      left.appendChild(b);
    }

    const file = el('div', 'path-mono', `${n.file} → ${n.fn}`);
    file.style.marginTop = 'auto';
    left.appendChild(file);

    const right = el('div', 'panel');
    right.style.flex = '1';
    right.style.display = 'flex';
    right.style.flexDirection = 'column';
    right.style.justifyContent = 'center';
    panel.appendChild(right);
    n.illustrate(right);
  });

  addNote(r);

  // ---- retry-policy beat ----------------------------------------------
  const retryPanel = el('div');
  retryPanel.style.position = 'absolute';
  retryPanel.style.inset = '0';
  retryPanel.style.display = 'flex';
  retryPanel.style.gap = '56px';
  contentWrap.appendChild(retryPanel);

  const rpLeft = el('div');
  rpLeft.style.flex = '0 0 760px';
  rpLeft.style.display = 'flex';
  rpLeft.style.flexDirection = 'column';
  rpLeft.style.gap = '16px';
  retryPanel.appendChild(rpLeft);
  rpLeft.appendChild(el('div', 'eyebrow', 'ROUTING POLICY'));
  const rh = el('div', null, 'Retry policy');
  rh.style.fontSize = '50px';
  rh.style.fontWeight = '800';
  rpLeft.appendChild(rh);
  const rs = el('div', 'body-text', 'Named flags drive a retry, never a raw score — capped at three attempts total.');
  rs.style.fontSize = '30px';
  rpLeft.appendChild(rs);
  const rf = el('div', 'path-mono', 'atsScoreAndRecruiter.js → shouldRetryAutomatically()');
  rf.style.marginTop = 'auto';
  rpLeft.appendChild(rf);
  const rf2 = el('div', 'path-mono', 'routes/applications.js — MAX_RETRY_COUNT = 3');
  rpLeft.appendChild(rf2);

  const rpRight = el('div', 'panel');
  rpRight.style.flex = '1';
  rpRight.style.display = 'flex';
  rpRight.style.flexDirection = 'column';
  rpRight.style.justifyContent = 'center';
  retryPanel.appendChild(rpRight);
  tableList(rpRight, [
    { left: 'missingRequirement', right: 'retry', variant: 'accent' },
    { left: 'excessiveRewrite', right: 'retry, or flag above a rewrite threshold', variant: 'accent' },
    { left: 'poorReadability', right: 'retry', variant: 'accent' },
    { left: 'unsupportedClaim', right: 'flag for review — never auto-retried', variant: 'danger' },
    { left: 'low score only', right: 'no retry — proceed to approval', variant: 'muted' },
  ]);

  // ---- update: toggle active pill + which content panel is visible ----
  const allKeys = ['railIntro', ...NODE_KEYS, 'retryPolicy'];

  function update(tMs) {
    const tS = tMs / 1000;

    // which beat are we in
    for (const key of Object.keys(PL)) {
      const [s, e] = PL[key];
      const on = tS >= s && tS < e;
      if (nodePanels[key]) nodePanels[key].style.display = on ? 'flex' : 'none';
      if (key === 'retryPolicy') retryPanel.style.display = on ? 'flex' : 'none';
    }

    // pill highlight: active during its own node window, and during the
    // retry-policy beat every retry-eligible stage glows softly.
    NODES.forEach((n, i) => {
      const [s, e] = PL[n.key];
      const active = tS >= s && tS < e;
      const p = pills[i];
      p.circle.setAttribute('fill', active ? '#F5B83D' : '#1D2A4D');
      p.circle.setAttribute('stroke', active ? '#F5B83D' : '#A3AECB');
      p.numText.setAttribute('fill', active ? '#1D2A4D' : '#F2F4F9');
      p.label.style.color = active ? '#F2F4F9' : 'var(--text-secondary)';
      p.label.style.fontWeight = active ? '700' : '400';
    });

    // skip arc emphasis during node4, retry arc emphasis during node9 + retryPolicy
    const inNode4 = tS >= PL.node4[0] && tS < PL.node4[1];
    skipArc.setAttribute('opacity', inNode4 ? '1' : '0.28');
    skipArc.setAttribute('stroke-width', inNode4 ? '5' : '3');
    skipLabel.style.opacity = inNode4 ? '1' : '0';

    const inRetryBeat = (tS >= PL.node9[0] && tS < PL.node9[1]) || (tS >= PL.retryPolicy[0] && tS < PL.retryPolicy[1]);
    retryArc.setAttribute('opacity', inRetryBeat ? '1' : '0.28');
    retryArc.setAttribute('stroke-width', inRetryBeat ? '5' : '3');
    retryLabel.style.opacity = inRetryBeat ? '1' : '0';

    // main line dash-offset "stitches in" across the full pipeline
    const total = PL.node10[1];
    const frac = Math.min(1, Math.max(0, tS / total));
    const len = mainLine.getTotalLength ? mainLine.getTotalLength() : 1540;
    mainLine.setAttribute('stroke-dashoffset', String(len * (1 - frac)));
  }

  return { update };
});

// =============================================== Scene 6 — Export =========

registerScene(T.exportScene, (ctx) => {
  const r = ctx.root;
  addBrand(r);
  const panel = el('div');
  panel.style.position = 'absolute';
  panel.style.left = '140px';
  panel.style.right = '860px';
  panel.style.top = '220px';
  panel.style.bottom = '140px';
  panel.style.display = 'flex';
  panel.style.flexDirection = 'column';
  panel.style.justifyContent = 'center';
  panel.style.gap = '26px';
  r.appendChild(panel);

  panel.appendChild(el('p', 'eyebrow', 'AFTER APPROVAL · NOT A GRAPH NODE'));
  const h = el('h2', 'heading', 'Export, on demand');
  h.style.fontSize = '58px';
  panel.appendChild(h);
  const s = el('p', 'body-text', 'Built fresh from MongoDB on request, once an application is approved &mdash; never auto-saved.');
  s.style.fontSize = '32px';
  panel.appendChild(s);

  chipsRow(panel, [
    { text: 'resume.docx', variant: 'accent' },
    { text: 'resume.pdf', variant: 'accent' },
    { text: 'cover-letter.docx', variant: 'accent' },
    { text: 'cover-letter.pdf', variant: 'accent' },
    { text: 'tracker.xlsx', variant: 'accent' },
  ]);

  const file = el('div', 'path-mono', 'routes/applications.js — GET /:id/export/resume.docx  (gated on status === ‘approved’)');
  panel.appendChild(file);
  const file2 = el('div', 'path-mono', 'buildExportFilename.js → FirstName_LastName_CompanyName_Resume.docx');
  panel.appendChild(file2);

  const items = [...panel.querySelectorAll(':scope > *')];
  revealStagger(ctx, items, 0, 180);

  const imgPanel = el('div', 'panel');
  imgPanel.style.position = 'absolute';
  imgPanel.style.right = '140px';
  imgPanel.style.top = '220px';
  imgPanel.style.bottom = '140px';
  imgPanel.style.width = '660px';
  imgPanel.style.display = 'flex';
  imgPanel.style.alignItems = 'center';
  imgPanel.style.justifyContent = 'center';
  r.appendChild(imgPanel);
  screenshot(imgPanel, 'download_menu.png');
  ctx.add(imgPanel, [{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 500, delay: 260 });
  addNote(r);
});

// ============================================== Scene 7 — Outreach ========

registerScene(T.outreach, (ctx) => {
  const r = ctx.root;
  addBrand(r);

  const head = el('div');
  head.style.position = 'absolute';
  head.style.left = '140px';
  head.style.top = '150px';
  head.appendChild(el('p', 'eyebrow', 'A FOURTH, LIGHTER FEATURE'));
  const h = el('h2', 'heading', 'Outreach Tracker');
  h.style.fontSize = '58px';
  h.style.marginTop = '14px';
  head.appendChild(h);
  const s = el('p', 'body-text', 'Draft-only AI emails for direct contacts &mdash; nothing is ever sent, and no site is fetched.');
  s.style.fontSize = '30px';
  s.style.marginTop = '14px';
  head.appendChild(s);
  r.appendChild(head);
  ctx.add(head, [{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 500 });

  const row = el('div');
  row.style.position = 'absolute';
  row.style.left = '140px';
  row.style.right = '140px';
  row.style.top = '440px';
  row.style.bottom = '160px';
  row.style.display = 'flex';
  row.style.gap = '48px';
  r.appendChild(row);

  const left = el('div', 'panel');
  left.style.flex = '0 0 560px';
  left.style.display = 'flex';
  left.style.alignItems = 'center';
  left.style.justifyContent = 'center';
  row.appendChild(left);
  screenshot(left, 'outreach_contact.png');

  const right = el('div', 'panel');
  right.style.flex = '1';
  right.style.display = 'flex';
  right.style.alignItems = 'center';
  right.style.justifyContent = 'center';
  row.appendChild(right);
  screenshot(right, 'outreach_draft.png');

  revealStagger(ctx, [left, right], 300, 260);

  const file = el('div', 'path-mono', 'routes/outreach.js → POST /:id/contacts/:contactId/generate-email · gpt-4o-mini');
  file.style.position = 'absolute';
  file.style.left = '140px';
  file.style.bottom = '72px';
  r.appendChild(file);
  ctx.add(file, [{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: 900 });

  addNote(r);
});

// ============================================= Scene 8 — Guardrails =======

registerScene(T.guardrails, (ctx) => {
  const r = ctx.root;
  addBrand(r);
  const head = el('div');
  head.style.position = 'absolute';
  head.style.left = '140px';
  head.style.top = '150px';
  head.appendChild(el('p', 'eyebrow', 'WHAT THE CODE ENFORCES'));
  const h = el('h2', 'heading', 'Guardrails');
  h.style.fontSize = '58px';
  h.style.marginTop = '14px';
  head.appendChild(h);
  r.appendChild(head);
  ctx.add(head, [{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 500 });

  const list = el('div');
  list.style.position = 'absolute';
  list.style.left = '140px';
  list.style.top = '390px';
  list.style.right = '140px';
  list.style.display = 'flex';
  list.style.flexDirection = 'column';
  list.style.gap = '28px';
  r.appendChild(list);

  const guardrails = [
    'Never invent anything &mdash; only retrieval and rephrasing from your own resume, checked before you see it.',
    'You approve everything &mdash; nothing is saved or exported without your review.',
    'Retry is driven by named problems, never a score to chase.',
    'No URL fetching, ever &mdash; job text and company notes are pasted in, never scraped.',
  ];

  const rows = guardrails.map((text) => {
    const row = el('div', 'panel');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '24px';
    row.style.padding = '28px 36px';
    const dash = el('div');
    dash.style.flexShrink = '0';
    dash.style.width = '14px';
    dash.style.height = '14px';
    dash.style.borderRadius = '50%';
    dash.style.background = 'var(--accent)';
    row.appendChild(dash);
    const t = el('div', null, text);
    t.style.fontSize = '32px';
    row.appendChild(t);
    list.appendChild(row);
    return row;
  });

  revealStagger(ctx, rows, 260, 420);
});

// =================================================== Scene 9 — Outro ======

registerScene(T.outro, (ctx) => {
  const r = ctx.root;
  const wrap = el('div');
  wrap.style.position = 'absolute';
  wrap.style.inset = '0';
  wrap.style.display = 'flex';
  wrap.style.flexDirection = 'column';
  wrap.style.alignItems = 'center';
  wrap.style.justifyContent = 'center';
  wrap.style.gap = '26px';
  r.appendChild(wrap);

  const mark = el('div');
  mark.style.width = '60px';
  mark.style.height = '60px';
  mark.style.border = '3px dashed var(--accent)';
  mark.style.borderRadius = '16px';
  mark.style.transform = 'rotate(6deg)';
  wrap.appendChild(mark);

  const name = el('div', null, 'ResumeStitch AI');
  name.style.fontSize = '54px';
  name.style.fontWeight = '800';
  wrap.appendChild(name);

  const by = el('div', null, 'Built by AbdulRaheem');
  by.style.fontSize = '32px';
  by.style.color = 'var(--text-secondary)';
  wrap.appendChild(by);

  ctx.add(mark, [{ opacity: 0, transform: 'rotate(-18deg) scale(0.7)' }, { opacity: 1, transform: 'rotate(6deg) scale(1)' }], { duration: 600 });
  ctx.add(name, [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 600, delay: 180 });
  ctx.add(by, [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 600, delay: 380 });
});

// ------------------------------------------------------------------ seek --

window.seek = function seek(tSeconds) {
  for (const s of scenes) {
    const active = tSeconds >= s.start && tSeconds < s.end;
    s.root.classList.toggle('on', active);
    if (active) s.update((tSeconds - s.start) * 1000);
  }
};

window.__scenesReady = true;
