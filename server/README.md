# ResumeStitch AI — Server

Express + MongoDB + LangChain.js/LangGraph.js backend for ResumeStitch AI, a
personal job-application assistant. It parses resumes, tailors them against a
pasted job description through an 11-step LangGraph pipeline, verifies every
claim against the source resume before scoring it, and pauses for human
approval before anything is saved or exported. A separate, lighter Outreach
Tracker (companies/contacts + draft-only AI emails) shares only auth and
resume data with the pipeline.

See the repo root for the full picture:
[`job-application-agent-workflow.md`](../job-application-agent-workflow.md)
(the technical spec — exact node numbers and behavior),
[`about-this-project.md`](../about-this-project.md) (what this is and why),
and [`key-decisions-log.md`](../key-decisions-log.md) (why things are built
the way they are).

## Requirements

- Node.js 22+
- MongoDB (a connection string your user can read/write)
- An OpenAI API key
- [LibreOffice](https://www.libreoffice.org/) (`soffice` on `PATH`) — only
  needed for PDF export (`convertDocxToPdf.js` shells out to
  `soffice --headless --convert-to pdf`); `.docx` export and everything else
  works without it

## Setup

```bash
npm install
cp .env.example .env   # see below — no .env.example is committed; create .env directly
npm run dev
```

The dev script uses `nodemon`, which restarts on file changes (a plain
`node src/index.js` run under `npm start` will not pick up edits — see
`key-decisions-log.md` for why this matters).

## Environment variables

| Variable | Required | Default | Notes |
|---|---|---|---|
| `MONGODB_URI` | yes | — | Connection string; the server logs a warning and keeps running without it, but nothing will actually persist |
| `JWT_SECRET` | **yes** | — | Server refuses to start if unset — see `src/index.js` |
| `OPENAI_API_KEY` | yes | — | Read implicitly by the OpenAI SDK (`ChatOpenAI`); every LLM-calling node needs it |
| `PORT` | no | `5000` | |
| `CLIENT_ORIGIN` | no | `http://localhost:5173` | CORS origin allow-list |
| `JWT_EXPIRES_IN` | no | `30d` | Passed straight to `jsonwebtoken`'s `expiresIn` |
| `RESET_TOKEN_EXPIRES_MS` | no | `3600000` (1h) | Forgot-password token lifetime |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | no | — | If `SMTP_HOST` is unset, password-reset emails aren't sent — the reset link is logged to the console instead (dev-mode fallback, never crashes) |
| `EMAIL_FROM` | no | `no-reply@localhost` | From-address for password-reset emails |

## Scripts

```bash
npm run dev     # nodemon src/index.js — restarts on file changes
npm start       # node src/index.js — no file watching, for production
npm test        # node --test src/**/*.test.js — the full unit test suite
```

Tests are plain `node:test` + `assert/strict` unit tests against pure,
exported functions (`gapAnalysis.test.js`, `tailorContent.test.js`, etc.) —
there's no integration-test setup (no `supertest`, no
`mongodb-memory-server`) by deliberate convention; every service is designed
to be testable as a pure function first. Run a single file directly, e.g.:

```bash
node --test src/services/gapAnalysis.test.js
```

## Project structure

```
src/
  index.js              Express app: CORS, JSON body limit, route mounts, error handler, startup
  config/                MongoDB connection
  middleware/            JWT auth middleware (authenticate)
  models/                Mongoose schemas (User, MasterResume, ResumeBullet, Application, OutreachCompany, ...)
  graph/
    jobAgentGraph.js      The LangGraph StateGraph — all 10 pipeline nodes and their edges
    graphInstance.js       MongoDB-backed checkpointer wiring
  routes/
    auth.js                signup/login/forgot-password/reset-password
    resumes.js              upload/parse/edit/export master resumes
    applications.js          submit a JD, run/retry the pipeline, approve, export
    outreach.js               Outreach Tracker CRUD + AI email drafting
  services/               Every pipeline node's real logic lives here as a pure,
                           independently testable function — the graph nodes in
                           jobAgentGraph.js are thin wrappers around these
```

## The pipeline, briefly

One LangGraph thread per submitted job description
(`thread_id = application._id`), checkpointed to MongoDB so a crashed run
resumes instead of restarting:

1. `extractJdKeywordsNode` — LLM (gpt-4o-mini)
2. `normalizeSkillsNode` — rule-based
3. `gapAnalysisNode` — rule-based, plus a conditional LLM call
4. `roleFitGateNode` — rule-based fast-pass + LLM (gpt-4o-mini); can skip straight to approval on a poor fit
5. `tailorContentNode` — LLM (gpt-4o), retrieval-and-rephrase only, never free generation
6. `deterministicVerificationNode` — rule-based; the primary anti-fabrication check
7. `coverLetterGenerationNode` — LLM (gpt-4o), conditional on `coverLetterRequested`
8. `styleLintingNode` — rule-based + LLM escalation for ambiguous cases
9. `atsScoreAndRecruiterNode` — LLM (gpt-4o); raises named flags, not just a score
10. `humanApprovalNode` — `interrupt()`; nothing is saved until you approve, edit, or send it back

Exact node numbers, data model, and the retry/routing policy are the
authoritative content of `job-application-agent-workflow.md` — this file is
a map to the code, not a second spec.
