# ResumeStitch AI — Client

React 19 + Vite frontend for ResumeStitch AI. Upload and manage master
resumes, submit a job description against one, review the AI-tailored result
diff-by-diff and approve/edit/send it back, export the approved result as
`.docx`/`.pdf`, and track direct outreach to companies separately from the
tailoring pipeline.

See the repo root for the full picture:
[`job-application-agent-workflow.md`](../job-application-agent-workflow.md)
(the technical spec this UI implements) and
[`about-this-project.md`](../about-this-project.md) (what this is and why).

## Requirements

- Node.js 22+
- The [server](../server) running (locally or deployed) — this app is a pure
  client against that API, nothing runs standalone

## Setup

```bash
npm install
npm run dev
```

Defaults to `http://localhost:5000` as the API base. To point at a different
backend (e.g. a deployed one), set `VITE_API_URL` at build/dev time — see
`src/lib/api.js`:

```bash
VITE_API_URL=https://your-deployed-server npm run dev
```

## Scripts

```bash
npm run dev       # vite — dev server with HMR
npm run build     # vite build — production bundle to dist/
npm run preview   # vite preview — serve the production build locally
npm run lint      # oxlint
```

There's no client-side test runner (`package.json` has no `test` script) —
by convention, UI changes in this project are verified by hand in a running
browser, not with a unit/component test suite. Type checking and lint catch
syntax/type issues; they don't substitute for actually clicking through a
change.

## Stack notes

- **Routing**: `react-router-dom` v7, with every authenticated route behind
  `ProtectedRoute` (see `App.jsx`).
- **Styling**: Tailwind v4 via `@tailwindcss/vite` (no separate PostCSS
  config needed), with shadcn/radix primitives in `src/components/ui/`.
- **API calls**: `src/lib/api.js` exports the base URLs; `apiFetch()`
  (`src/lib/`) wraps `fetch` with the JWT `Authorization` header attached
  automatically.
- **Path alias**: `@/` resolves to `src/` (see `vite.config.js`).

## Project structure

```
src/
  main.jsx, App.jsx        Entry point and route table
  pages/                    One file per route — Applications, Apply, Approval,
                             MasterResumes, ResumeDetail, ResumeBullets,
                             OutreachTracker, OutreachCompanyDetail, Profile,
                             Login/Signup/ForgotPassword/ResetPassword
  components/
    ui/                      shadcn/radix primitives (Button, Dialog, Select, ...)
    approval/                 Approval page's 17 focused subcomponents
    ...                       Other feature-scoped components (Sidebar, EditableEntryList, ...)
  context/                   AuthContext (JWT session state)
  hooks/                     Shared React hooks
  lib/                       api.js (base URLs), apiFetch, misc utilities
```

## Key pages, mapped to the pipeline

- **`MasterResumes.jsx`** / **`ResumeDetail.jsx`** / **`ResumeBullets.jsx`** —
  resume management, entirely outside the LangGraph pipeline (spec §2).
- **`Apply.jsx`** — single-JD submission: pick a resume, paste a JD (spec §3).
- **`Applications.jsx`** — server-paginated list of every submitted
  application.
- **`Approval.jsx`** — the human-approval surface for node 10
  (`interrupt()`): tailored bullets/summary/title with AI/human/final text
  tracked separately, ATS score and flags, re-check, suggest-missing-skills,
  and the Download menu (on-demand `.docx`/`.pdf` export).
- **`OutreachTracker.jsx`** / **`OutreachCompanyDetail.jsx`** — the Outreach
  Tracker: a separate CRUD feature (companies/contacts) plus draft-only AI
  email generation, sharing only auth and resume data with the main
  pipeline.
