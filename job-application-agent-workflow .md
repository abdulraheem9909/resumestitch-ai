# Job Application Agent — Development Workflow

Stack: MERN (MongoDB, Express, React, Node) + LangChain.js + LangGraph.js.

## 1. Architecture at a glance

Three parts:

- **Resume management** — upload, parse, and edit master resumes. Runs entirely outside the LangGraph pipeline, once per resume, not once per JD.
- **Single-JD submission** — pick an already-parsed master resume, paste one JD's text. No batching, no queue — one application processed at a time.
- **Per-JD thread pipeline** — a LangGraph `StateGraph`, one run per submitted JD, identified by a unique `thread_id`. Runs from JD parsing through ATS scoring and pauses for human approval before anything is saved.

Every node is designed to be **idempotent** and every generation is **versioned** — see sections 6 and 7 before writing any node.

---

## 2. Resume management (outside the pipeline)

Resume parsing happens **once, on upload — it never runs inside a LangGraph thread.** A LangGraph thread only ever *reads* an already-parsed resume's bullets; it never parses a file itself.

### 2.1 Upload → parse
1. **Upload resume file** (React) — `.docx`/`.pdf` file picker.
2. **Text extraction** — `mammoth` for `.docx`, `pdf-parse` for `.pdf`. Deterministic, no LLM.
3. **Segmentation** — rule-based split into individual bullet lines, with role/company/dateRange attached from section headers (bullet characters, date-range patterns). Deterministic, no LLM — cheap and easy to debug.
4. **LLM tagging** — one structured-output call per bullet (GPT-4o-mini) extracts `skills` and `metrics` from that single line. This is the only LLM step in the whole upload flow, and it's a one-time cost per resume, not a recurring per-JD cost.

### 2.2 Cap + save
5. **Cap check** — a user may have at most **5 master resumes**. If already at 5, saving is blocked with "delete a resume first" until they remove one.
6. **Save** — writes a new `masterResumes` document plus one `resumeBullets` document per bullet, all tagged with that resume's `_id`.

### 2.3 In-app bullet editing
- Editing a bullet modifies its `resumeBullets` document **directly** — no file re-parse needed, since bullets already exist as independent database rows once a resume has been uploaded.
- An edit is scoped to exactly the bullet being changed; every other bullet in that resume (and every other resume) is untouched.
- Re-uploading a whole new file (rather than editing bullets in-app) is a separate, heavier operation — out of scope for the current build; in-app editing is the primary way a resume is kept up to date.

### 2.4 Deletion cascade
Deleting a master resume is destructive and cascades in full, in this order, before the deletion completes:
1. Delete all `applications` documents linked to that `masterResumeId` (the JDs processed against it).
2. Delete any generated output files (`.docx` resumes/cover letters) tied to those applications.
3. Delete the LangGraph checkpoint/thread history for each of those applications.
4. Delete every `resumeBullets` document tied to that `masterResumeId`.
5. Delete the `masterResumes` document itself.

This is what makes room under the 5-resume cap — uploading a 6th resume requires deleting one of the existing 5 first, which triggers the full cascade above.

### 2.5 Single-application deletion
Deleting one `applications` document (independent of, and lighter than, the resume-wide cascade in 2.4 — no `resumeBullets` or `masterResumes` involvement) does, in order:
1. Delete the `applications` document itself.
2. Delete its LangGraph checkpoint/thread history.
3. Delete its `GenerationCache` entries.

Not gated by application status — this can delete an application in any state, not just `approved` ones.

---

## 3. Single-JD submission (no batching, no URL fetching)

- **Resume list (React)** — the user selects one already-parsed master resume. This selection scopes everything downstream.
- **JD submission (React)** — the user pastes the JD text directly, along with the **company name**, and an **optional reference URL** — a plain text field for the original listing link, stored purely for the user's own later reference (e.g. finding the posting again after an interview call). This URL is never fetched or processed server-side; it's just saved and rendered as a clickable link. A **cover letter toggle** (default off or on, either way) is set here too, and is stored as `coverLetterRequested` on the `applications` document — see node 7.
- **Express: create + start** — normalizes the pasted JD text and hashes it (`jdTextHash`), checks MongoDB for an existing `applications` document with the same `(masterResumeId, jdTextHash)` pair (dedupe — see note below), creates a new `applications` document with the JD snapshot, company name, and optional reference URL, loads the selected resume's `resumeBullets` into the initial graph state, and starts a LangGraph run with `thread_id = applications._id`.

There is no queue and no parallel dispatch — one JD is processed at a time, start to finish, per active resume session.

**Dedupe note:** matching on a hash of the pasted text catches exact re-submissions, but won't catch the same job pasted with a minor formatting difference (an extra line break, a fixed typo), or the same job posted on two different sites with slightly different wording. That's an accepted limitation, not something this dedupe check is designed to solve.

---

## 4. Per-JD thread pipeline (LangGraph `StateGraph`)

Resume bullets are already loaded into state by Express before the graph starts, and the JD text arrives already in hand from the pasted submission — there is no fetch or resume-parsing node inside the graph itself. State persists via a MongoDB-backed LangGraph checkpointer, so a crashed run resumes from its last completed node instead of restarting.

| # | Node | Tech | What it does |
|---|------|------|---------------|
| 1 | **JD keyword extraction** | LangChain `ChatOpenAI` (GPT-4o-mini) + Zod structured output | Extracts required skills, tools, and seniority signals from the pasted JD text as structured JSON. |
| 2 | **Skill normalization** | Deterministic alias dictionary (no LLM) | Canonicalizes both JD keywords and the loaded resume's skill tags against a controlled taxonomy (e.g. "Node.js" / "Node" / "NodeJS" → `node.js`) before any comparison happens. Prevents false gaps from surface-form mismatches. |
| 3 | **Gap analysis** | Plain JS | Set diff between canonical JD skill IDs and canonical resume skill IDs. |
| 4 | **Role fit gate** | Overlap % (free) + cheap LLM plausibility check (GPT-4o-mini) on borderline cases | Checks whether this JD is a sane target for this resume *before* spending any tailoring effort. Two stages: (a) if canonical skill overlap from node 3 is below a floor, exit immediately, no LLM call; (b) if overlap is in a middle/ambiguous band, one cheap call asks "is this a plausible target role or a different discipline entirely" and returns a categorical judgment, not a score. On low fit, the graph skips straight to node 10 (human approval) with a `role_mismatch` reason — nodes 5–9 never run. On a plausible result, continues to node 5. See section 5a. |
| 5 | **Tailor content (STAR method)** | LangChain `ChatOpenAI` (GPT-4), temperature ≈ 0, Zod structured output, cached by input hash | Classifies every candidate bullet rather than picking a top-N subset: the model returns one entry per candidate `bulletId` with a `rejected` boolean, defaulting to keeping a bullet (`rejected: false`) unless it is genuinely out of context for this JD — a different domain/skillset entirely, not merely "less relevant than the others." A kept bullet is reframed into Situation/Task/Action/Result only when doing so would genuinely improve its match to the JD, leaving an already-clear, already-well-matched bullet close to its original wording rather than rewriting it for its own sake; a rejected bullet's text is forced back to its source verbatim (`rephraseIntensity: 0`) since it never leaves the tailored set for review, it's just excluded from anything downstream. Rephrase/reorder only for kept bullets — never introduces a skill, tool, employer, title, or metric absent from the source bullet. Also synthesizes a tailored 2–3 sentence `tailoredSummary` from three retrieved inputs only — the bullets it did *not* reject for this JD, the matched canonical skills from node 3's overlap (not the gap), and total years of experience computed deterministically from `resumeBullets`/`education` date ranges (plain JS, not the model's guess). Same constraint as bullets: rephrase/reorder only, never introduce a skill, tool, employer, or figure absent from those three inputs. `personalInfo.title` and `masterResumes.summary` itself are never overwritten — the summary tailoring reads from the master resume but writes only to the application's `tailoredSummary`. Result is cached keyed on `(applicationId, nodeName, inputHash, promptVersion, model)` — a retry with identical inputs reuses the cached generation instead of re-calling the model. After the model's own classification comes back, two deterministic (non-LLM) guarantees run on top of it, since the model's own judgment alone isn't reliable enough for either: (a) if this retry was triggered by accepting a suggest-missing-skills bullet (section 4a), that bullet is force-un-rejected (included verbatim) if the model marked it rejected — the whole point of adding it was to close that specific gap; (b) every employer with at least one candidate bullet is guaranteed at least one non-rejected bullet (picking whichever of its bullets has the most JD-skill overlap and un-rejecting it in place), so classification can never silently drop an entire employer from the work history. Both guarantees reuse the source bullet's text verbatim (no extra LLM call, zero fabrication risk) and still flow through node 6 like any other bullet. A hand-edited bullet or summary (`editSource: "human"`) from a previous round is also preserved as-is across a retry — including forcing `rejected: false` — rather than being overwritten or excluded by the fresh regeneration. Every downstream node (6-9) that reads `tailoredBullets` filters out rejected ones first, so an out-of-context bullet never influences the cover letter, style lint, or ATS score even though it's still shown to the human on the Approval page. |
| 6 | **Deterministic verification** | Rule-based text matching against `resumeBullets` | Extracts claims/skills from the tailored bullet and confirms each exists in its `sourceBulletId` record or tags. Also checks the tailored summary the same way: every skill/technology/domain claim in `tailoredSummary` must trace back to a matched canonical skill or a selected bullet. This is the primary fabrication check — separate from and running before scoring, so a factual problem is caught on its own terms rather than folded into a single ATS number. |
| 7 | **Cover letter generation** | LangChain `ChatOpenAI` (GPT-4), same source constraints as node 5 | Conditional — runs only if `coverLetterRequested` was set at submission; otherwise this node is skipped and the graph proceeds straight to node 8. When it runs, generates `coverLetterText` from the same verified bullet set and gap analysis. |
| 8 | **Style linting** | Mostly rule-based (Node regex) | Strips AI-sounding phrasing, checks formatting (no tables/text boxes, consistent bullet/date format). Escalates ambiguous cases to a cheap LLM call only when needed. |
| 9 | **ATS score + mock recruiter** | LangChain `ChatOpenAI` (GPT-4), single structured call | Returns a numeric ATS estimate, a qualitative recruiter critique, **and explicit flags**: `missingRequirement`, `unsupportedClaim`, `excessiveRewrite`, `poorReadability`. See section 5 — the score alone is never sufficient reason to retry. |
| 10 | **Human approval (`interrupt()`)** | LangGraph `interrupt()` + React | Graph pauses. React shows the diff, recruiter critique, and any flags — or, if routed here from node 4, the role-mismatch reason instead. The tailored summary is shown alongside the tailored bullets, using the same `generatedText`/`humanEditedText`/`finalText` distinction. State keeps `generatedText`, `humanEditedText`, and `finalText` as distinct fields — see section 7. You approve as-is, hand-edit directly, or send back to node 5 with notes. Two additional actions available here, both detailed below: **re-check** and **suggest missing skills**. |
| 11 | **Log + export** | Mongoose + `docx` + `exceljs` | Writes the final `applications` row and versioning metadata as part of the graph's own state persistence (idempotent — safe to run twice for the same `applicationId`). **`.docx`/`tracker.xlsx` generation itself is not a graph node** — it's implemented as on-demand `GET` routes (`/:id/export/resume.docx`, `/export/tracker.xlsx`) that build the file fresh from MongoDB each time it's requested, gated on `status === 'approved'`, and never store the file server-side. This was a deliberate deviation from "automatic write-time export" — see `key-decisions-log.md`. The resume export route filters `tailoredBullets` to `!rejected` before building the `.docx` — a bullet the AI judged out of context for the JD (section 4, node 5) is still visible with a tag on the Approval page but never appears in the exported file. |

### 4a. Two additional actions at human approval (node 10)

**Re-check.** If you hand-edit the tailored text yourself, nothing in the graph has scored *your* version — only the AI's pre-edit draft was ever run through node 9. Re-check is a non-blocking action: it re-runs node 6 (deterministic verification) and node 9 (ATS + mock recruiter) against your edited text and displays the updated score/flags. It does not gate export and does not count against `retryCount` — it's informational, not another approval hoop. Because the original AI-generated score shouldn't be overwritten by this, the result is stored separately: `humanRecheckAtsScore` and `humanRecheckAtsFlags`, alongside (not replacing) `atsScore` and `atsFlags`.

**Suggest missing skills.** The `keywordGaps` already computed by node 3 (gap analysis) are surfaced here — skills the JD wants that your resume doesn't currently cover. If one of them is something you genuinely have real experience with that just never made it into your seeded resume, you can add it as a new bullet. This does **not** insert text directly into the tailored output — doing so would bypass every fabrication guardrail built into nodes 5–7. Instead, accepting a suggestion routes through the same one-time flow described in section 2.1: you write the real bullet, it goes through the same LLM tagging step (skills + metrics extraction) as any normally-uploaded bullet, and it's saved to `resumeBullets` under the current `masterResumeId`. Optionally, you can attach the new bullet to an existing employer in your resume (picked from a dropdown of your current `role`/`company`/`dateRange` combinations) — otherwise it's saved with no employer, same as before. The graph then sends itself back to node 5 (the same "send back with notes" pathway already used for manual retries) so the new bullet is available for this tailoring pass, and node 5's force-include guarantee (see the node 5 row above) ensures it actually lands in the tailored output rather than depending on the model choosing it. Because it's a real `resumeBullets` entry with its own `sourceBulletId`, it flows through verification (node 6) exactly like any other bullet — no guardrail is bypassed, and your master resume ends up more complete for future applications too.

**Retry re-derives the skill gap list, not just the JD side.** Both the manual and suggest-missing-skills retry paths route back through node 3 (gap analysis) before re-tailoring, so `resumeCanonicalSkills`/`keywordGaps` are recomputed from whatever `resumeBullets` currently holds — not left as a stale snapshot from the very first pass. Node 4 (role fit gate) is still only ever run on the true first pass, not on a retry.

---

## 5. Retry policy — explicit conditions, not a single threshold

The retry edge after node 9 checks specific flags rather than a raw score:

| Condition | Action |
|---|---|
| Missing an important JD requirement | Retry (back to node 5) |
| Unsupported claim — in a tailored bullet or the tailored summary (verification already should have caught this in node 6 — this is a second check) | Reject/flag for human review, don't silently retry |
| Excessive rewrite (low similarity to source bullet) | Retry or flag, see rephrase-intensity in section 7 |
| Poor readability | Retry |
| Low ATS score, no other flag raised | **Do not retry automatically** — proceed to human approval; let the person decide whether it's good enough |

Cap retries at 3 regardless of reason, same as before.

## 5a. Role fit gate — a different problem from retry policy

The retry policy above governs *how well a plausible tailoring attempt turned out*. It doesn't handle the case where the JD and resume are a fundamentally different discipline (e.g. a recruiter JD against a software-engineer resume) — in that case, nodes 5–9 would still run, find almost nothing to work with, burn up to 3 full retry cycles, and still land on a bad result, because there's no more relevant material to surface on attempt 3 than attempt 1.

Node 4 exists specifically to catch this *before* any of that spend happens:

- **Stage 1 — overlap floor (free).** Canonical skill overlap from node 3, computed as a percentage. Below a floor (tune this empirically — start around 15–20%), exit immediately to node 10 with `role_mismatch`. No LLM call.
- **Stage 2 — cheap plausibility check (only for the ambiguous middle band).** One GPT-4o-mini call: is this a plausible target role or a different discipline entirely. Categorical judgment, not a score. Only runs when overlap is neither obviously fine nor obviously hopeless, so most JDs never hit this stage at all.

This keeps the common case (JD in your actual field) essentially free to gate, and only spends a small extra call on genuinely ambiguous cases — while a bad fit like recruiter-vs-engineer gets caught for the cost of a set-difference calculation, not three rounds of GPT-4 tailoring and scoring.

---

## 6. Idempotency

The combination of retries + LangGraph checkpointing + LLM calls + MongoDB writes means a run can die *after* an LLM call completes but *before* the checkpoint/DB write lands. On retry, that node could re-execute and re-call the model, or double-write to Mongo.

Design rule for every node: **same application + same node + same input → safe to execute twice.**

For LLM-calling nodes (1, 5, 7, 9), store the generation result keyed by:
```
{ applicationId, nodeName, inputHash, promptVersion, model }
```
A retry checks this cache before calling the model again. For the DB-writing node (11), use an upsert keyed on `applicationId` rather than an insert, so a repeated write updates the same document instead of creating a duplicate. (The JD snapshot itself is written once, in the Express create+start step of section 3, before the graph even starts — not inside the graph.)

---

## 7. Versioning and provenance

Beyond `sourceBulletId` (which ties a tailored bullet back to its true origin), track generation metadata so you can reconstruct *why* two applications produced different output from the same resume:

```
{
  resumeVersion: masterResumeId,   // the exact master resume selected for this run
  promptVersion: "tailor-v7",
  model: "gpt-4.x",
  graphVersion: "pipeline-v4",
  generationId: "..."
}
```

This becomes important the moment you tweak a prompt or switch models — without it, you can't tell whether a change in output quality came from your resume data or your pipeline code.

Separately, the human-approval state (node 10) keeps AI output and human edits distinct rather than overwriting one with the other:

```
{
  sourceBulletId,
  generatedText,      // what the model produced
  humanEditedText,     // what you changed it to, if anything
  finalText,           // what actually gets exported (unless rejected)
  editSource: "ai" | "human",
  rejected,            // true if node 5 judged this bullet out of context — shown on the
                        // Approval page with a tag, filtered out of every export/downstream node
  approvedAt
}
```

---

## 8. Data model

### `masterResumes` (one per uploaded resume, max 5 per user)
```
{
  _id,
  label: string,        // e.g. "Full-stack CV", "AI Engineering CV"
  uploadedAt,
  status: "active" | "deleted",
  personalInfo: {        // per-resume, entered via a form at upload time — never auto-extracted
    fullName, title, location, phone, email, linkedin, portfolio
  },
  summary: string,        // preserved verbatim, extracted deterministically (no LLM) from the SUMMARY heading
  education: [            // preserved verbatim, extracted deterministically from the EDUCATION heading
    { degree, institution, location, dateRange }
  ],
  projects: [              // preserved verbatim, extracted deterministically from the PROJECTS heading
    { name, description }
  ],
  skills: [string]         // the raw declared list from the SKILLS heading — distinct from
                           // resumeBullets.canonicalSkills, which is bullet-derived and deliberately
                           // excludes soft/methodology terms this list legitimately includes
}
```
`personalInfo.title`, `education`, `projects`, and `skills` are never tailored per JD — they exist so
a future export (node 11) has somewhere to pull the rest of a full resume from, reproducing everything
except Work Experience and the summary verbatim. `summary` here is the verbatim source text; it is one
of node 5's *inputs*, not overwritten by it — the tailored version is generated fresh per application
and lives on `applications.tailoredSummary` (see below), the same way tailored bullets live on
`applications.tailoredBullets` rather than overwriting `resumeBullets`.

### `resumeBullets` (tied to a specific master resume)
```
{
  _id,
  masterResumeId,             // which resume this bullet belongs to
  text: string,
  role: string,
  company: string,
  dateRange: string,
  skills: [string],
  canonicalSkills: [string],
  metrics: [string]
}
```

### `applications` (one per JD, one per thread)
```
{
  _id,                       // also used as LangGraph thread_id
  masterResumeId: string,    // which resume this JD was run against
  companyName: string,
  jobTitle: string,          // the specific role, so multiple applications to the same company stay distinguishable
  referenceUrl: string,      // optional, unfetched, user's own link back to the listing
  jdSnapshot: string,        // the pasted JD text
  jdTextHash: string,        // used for dedupe
  jdKeywords: [string],
  jdCanonicalSkills: [string],
  keywordGaps: [string],
  coverLetterRequested: boolean,
  tailoredBullets: [{
    bulletId, sourceBulletId,
    generatedText, humanEditedText, finalText,
    editSource, rephraseIntensity,
    rejected                  // node 5 judged this bullet out of context for the JD — kept on the
                               // Approval page (tagged) but filtered out of every export/downstream node
  }],
  tailoredSummary: {          // node 5's retrieval-bound synthesis from non-rejected bullets +
                               // matched skills + computed experience; never free generation
    generatedText, humanEditedText, finalText,
    editSource: "ai" | "human"
  },
  coverLetterText: string,    // empty/absent if coverLetterRequested is false
  atsScore: number,
  atsFlags: [string],         // missingRequirement | unsupportedClaim | excessiveRewrite | poorReadability
  humanRecheckAtsScore: number,   // set only if the re-check action (section 4a) was used
  humanRecheckAtsFlags: [string], // set only if the re-check action (section 4a) was used
  recruiterFeedback: string,
  resumeFilename: string,     // unpopulated — see node 11: export moved to on-demand routes,
  coverLetterFilename: string, // so nothing writes a filename onto the application anymore
  status: "queued" | "in_progress" | "role_mismatch" | "pending_approval" | "approved" | "logged",
  retryCount: number,
  generationMeta: { resumeVersion, promptVersion, model, graphVersion, generationId }, // also unpopulated, same reason
  createdAt, updatedAt
}
```
`resumeFilename`, `coverLetterFilename`, and `generationMeta` remain in the schema from the
original automatic-export design but nothing currently writes to them; the `"logged"` status
value is likewise never set by any code path today, since there's no automatic node-11 write
step to transition into it. Kept rather than removed in case on-demand export is later
supplemented with actual file logging — see `key-decisions-log.md`.

---

## 9. Suggested build order

**Status: all 10 steps below are implemented.** This section is kept as a record of the
build sequence that was actually followed, not as a forward-looking plan.

1. `masterResumes` + `resumeBullets` schema, skill taxonomy/alias dictionary, and the upload → parse → tag → cap-check → save flow (section 2).
2. In-app bullet editing (direct row updates).
3. Nodes 1, 2, 3 (extraction → normalization → gap analysis) tested against pasted JD text, against a manually-selected resume.
4. Node 4 (role fit gate) — cheap to build once node 3 exists, and worth having in place before you spend effort on tailoring.
5. Node 5 (tailoring) with the idempotency cache in place from the start.
6. Node 6 (deterministic verification) — build this alongside tailoring, not after; it's the primary safety net.
7. Node 10 (`interrupt()` + approval UI with AI/human/final text tracking, and a distinct display for `role_mismatch` results), including the re-check and suggest-missing-skills actions from section 4a.
8. Node 7 (cover letter — conditional on `coverLetterRequested`), node 8 (style linting), node 9 (ATS + recruiter with explicit flags) and the conditional retry edge from section 5.
9. Node 11 (idempotent logging + `docx`/`exceljs` export) with full versioning metadata.
10. Resume deletion cascade (section 2.4) — build once there's real data across applications/outputs/checkpoints to actually cascade through.
