# ResumeStitch AI — Claude Code Memory

@job-application-agent-workflow.md
@about-this-project.md
@key-decisions-log.md

## Priority
job-application-agent-workflow.md is the authoritative technical spec. Implement
exactly what it says, using its exact node numbers and section references. Don't
invent architecture it doesn't describe.

about-this-project.md is context only — the aim and audience, not a spec.

key-decisions-log.md is rationale only — it explains *why* the workflow is shaped
a certain way, not a second source of requirements.

If anything conflicts, job-application-agent-workflow.md wins.

## Working rules
- Reference exact section/node numbers when implementing or discussing a change.
- Don't propose architecture changes not already in the docs unless explicitly asked.
- Follow the build order in job-application-agent-workflow.md section 9 — don't
  skip ahead to a later node before its test gate has passed.