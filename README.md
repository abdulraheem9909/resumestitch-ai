# ResumeStitch AI

A personal, self-hosted job-application assistant. Give it a job description
and one of your parsed master resumes, and it tailors a resume and cover
letter against it, verifies every claim against your real resume before
scoring it, and pauses for your approval before anything is saved or
exported — nothing is ever auto-sent or auto-saved. Built with MERN
(MongoDB, Express, React, Node) and an agentic core written with
LangChain.js and LangGraph.js.

## Why this exists

Tailoring a resume well for every application takes real time, and doing it
by hand for dozens of applications doesn't scale. This project automates
that — not by generating freely, but by retrieving and rephrasing from your
own resume bullets, with a dedicated verification step that catches
anything that doesn't trace back to something you actually did. See
[`about-this-project.md`](about-this-project.md) for the full story,
including the real bugs found and fixed along the way.

## How it works, briefly

1. **Resume management** — upload a resume once; it's parsed into
   individual, editable bullets outside the pipeline entirely.
2. **Submit a job description** — paste the JD text and pick a resume. No
   batching, no URL fetching — one application at a time.
3. **A 10-node LangGraph pipeline** runs per submission: extract JD
   keywords → normalize skills → gap analysis → role-fit gate → tailor
   content (retrieval-and-rephrase, never free generation) →
   deterministic verification → cover letter (conditional) → style
   linting → ATS score + recruiter feedback → human approval
   (`interrupt()` — nothing saved until you say so).
4. **Export on demand** — `.docx`/`.pdf` for the resume and cover letter,
   built fresh from the approved data, never stored server-side.

A separate **Outreach Tracker** sits entirely outside the pipeline — a
plain CRUD tracker for companies/contacts you email directly, with
draft-only AI email generation (nothing is ever sent automatically).

The exact node numbers, data model, and retry policy are specified in
[`job-application-agent-workflow.md`](job-application-agent-workflow.md) —
the authoritative technical spec. The reasoning behind each design
decision (and the real bugs that led to them) is in
[`key-decisions-log.md`](key-decisions-log.md).

## Project structure

```
client/     React 19 + Vite frontend — see client/README.md
server/     Express + MongoDB + LangGraph backend — see server/README.md
```

## Quick start

```bash
# backend
cd server
npm install
# create a .env with MONGODB_URI, JWT_SECRET, OPENAI_API_KEY — see server/README.md
npm run dev

# frontend, in a second terminal
cd client
npm install
npm run dev
```

Full setup, environment variables, and scripts are documented in
[`server/README.md`](server/README.md) and
[`client/README.md`](client/README.md).

## Tech stack

MongoDB · Express · React 19 · Node.js · LangChain.js / LangGraph.js ·
OpenAI (GPT-4o / GPT-4o-mini) · Tailwind v4 + shadcn/radix · `docx` +
`exceljs` + LibreOffice (PDF export) · JWT auth.
