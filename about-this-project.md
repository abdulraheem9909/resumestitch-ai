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

Architecture and full workflow are designed and documented; build hasn't started yet. The workflow document includes a suggested build order — starting with resume parsing and the core tailoring loop, ending with the deletion cascade and any polish.
