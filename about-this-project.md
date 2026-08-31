# Job Application Agent — Project Overview

## What this is

A personal, self-hosted job application assistant. It takes a job description and one of my parsed master resumes, tailors a resume and cover letter against it, checks the result for ATS fit and factual accuracy, and lets me review and approve everything before anything is saved. It's built with a MERN stack (MongoDB, Express, React, Node) and an agentic core written with LangChain.js and LangGraph.js.

For the detailed technical spec — every node, the data model, and the diagrams — see the companion document, *Job Application Agent — Development Workflow*.

## Why I'm building it

I'm re-entering the job market after roughly two years away, targeting medium-to-large UK companies whose stack matches mine — Auto Trader, Checkout.com, Peak AI, Faculty AI, Luminance, Monzo, and Revolut among them. Tailoring a resume well for each application takes real time, and doing it by hand for dozens of applications doesn't scale.

This project solves that directly, and it does double duty: it's also a legitimate AI-engineering portfolio piece in its own right, since it demonstrates the exact skills I'm positioning around — RAG-style retrieval, agentic pipelines with LangGraph, and disciplined guardrail design — applied to a real problem I actually have, not a toy demo.

## What matters most about how it works

Three principles shaped almost every design decision in the workflow document:

- **Never invent anything about me.** Tailoring is retrieval and rephrasing from my own resume bullets, never open generation. A dedicated verification step checks every tailored claim against its source before it's ever shown to me. The goal isn't just "technically true" — it's a resume I can actually defend if someone asks about it in an interview.
- **I approve everything before it's used.** No resume or cover letter gets saved or exported without me reviewing the diff against my original wording first.
- **Don't optimize toward the wrong number.** The pipeline avoids reshaping my resume just to inflate an ATS score — retries are driven by specific, named problems (a missing requirement, an unsupported claim, poor readability), not a single score threshold that's easy to chase and easy to game.

## Who this is for

Just me, for now. It's scoped around one person managing a handful of master resumes and working through job descriptions one at a time — not a multi-tenant product, not built for scale. That scope is intentional: it kept the architecture simple enough to actually finish.

## Current state

**Phase 1 is complete.** The full pipeline described in the workflow document is built and working end-to-end: resume upload/parsing, the tailoring loop, deterministic verification, ATS scoring, human approval (with re-check and suggest-missing-skills), retry policy, resume deletion cascade, and on-demand `.docx`/`.xlsx` export. Real applications have been run through it against actual job postings (e.g. ConnexAI, Found Talent), which surfaced and led to fixing real bugs beyond the pipeline logic itself:

- Four pipeline-logic bugs: a stale skill-gap list after a retry, hand-edits getting silently overwritten by a later retry, a bullet added to plug a JD skill gap not reliably surviving the model's own selection, and bullet selection being able to drop an entire employer from the tailored resume.
- Two resume-parsing bugs, found by uploading a real resume of my own: a summary paragraph silently dropped entirely on a resume with no explicit `SUMMARY` heading, and education entries getting their degree/institution fields scrambled on a common layout the parser hadn't accounted for.
- A tailored-summary quality problem: the AI-generated summary kept restating the same achievement numbers already shown in the bullets directly below it. Took three prompt iterations to actually fix — the first two (a bare "include one metric" rule, then a reasoning-based "don't repeat a bullet's number" rule) both still failed a live test; the fix was realizing metrics in this system can *only* ever come from a bullet, so the rule had to be a flat "no metric at all, only years-of-experience" rather than a conditional one.

See `key-decisions-log.md` for the reasoning behind each fix.

Since then, two further features landed: the resume-upload form now deterministically pre-fills itself (name, title, contact details, a suggested label) from the file the moment it's selected, still fully editable before saving; and the Skills list is now editable in two independent scopes (permanently on the master resume, or scoped to just one application's export), with each skill chip color-coded to show whether it's genuinely backed by real bullet text — both purely display/export conveniences that never touch scoring or gap analysis. The loading and empty states across the app were also reworked with real spinners, an animated hourglass loader, and proper icon+message empty states, replacing plain "Loading…" text throughout.

Remaining work is mostly refinement rather than net-new pipeline stages — see the workflow document for anything still open.
