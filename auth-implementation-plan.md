# Full authentication (signup/login, JWT, protected + public routes)

## Context

This app currently has zero auth — no `User` model, no `userId` field on any
collection, no auth libraries on either side. Every route in
`server/src/routes/{applications,resumes}.js` (31 endpoints total) is wide
open, and the frontend has no concept of a logged-in user at all. This was a
deliberate scope decision (`about-this-project.md`: "just me, for now... not
a multi-tenant product") that the user has now explicitly decided to reverse
in favor of "future scaling." This plan adds real multi-user auth: JWT
issued on signup/login, stored in the browser's `localStorage`, sent as an
`Authorization: Bearer <token>` header on every request (user's explicit
choice over cookies — simpler, no CORS/credentials complexity, fully
stateless). The user also explicitly chose to make the currently-global,
shared `skillAliases.json` dictionary per-user rather than leaving it shared.

The user confirmed every document in the database today is disposable test
data — nothing needs to be preserved. This removes an entire category of
work: no migration script, no "add `userId` as optional, then tighten to
required after a verified backfill" two-step dance, no copying the old
shared `skillAliases.json` into a per-user record. `userId` is simply
`required: true` from the start, and existing collections can just be
dropped/cleared as part of implementation.

The user also asked for forgot-password / reset-password pages, which need
real email dispatch (no such infrastructure exists in this app today). To
avoid forcing an SMTP provider decision before this can even be tested, the
email step falls back to logging the reset link to the server console when
`SMTP_HOST` is unset — same "warn and continue, don't crash" style already
used for `MONGODB_URI` in `config/db.js` — so the flow is fully testable
locally and becomes real the moment SMTP credentials are added later.

Verified directly (not just from docs) via two research passes and a design
review: the full 31-endpoint route inventory, every model's field list, every
LangGraph `graph.invoke`/`getState`/`deleteThread` call site (all gated by an
`Application` lookup that happens first — no changes needed inside
`graphInstance.js`/`jobAgentGraph.js`'s graph-building code itself, only in
the node functions that read the skill-alias dictionary), the frontend's 27
raw `fetch()` call sites across 7 files with zero interceptor today, and the
two LangGraph node functions (`normalizeSkillsNode`, `deterministicVerificationNode`)
that must become `async` because they transitively read the skill-alias store.

## Design

### Backend — new files

- **`server/src/models/User.js`** — `{ email: unique/required/lowercase/trim,
  passwordHash: required, resetPasswordTokenHash: String (optional),
  resetPasswordExpires: Date (optional) }` + timestamps.
- **`server/src/models/SkillAliasDictionary.js`** — `{ userId: ObjectId ref
  User, unique, required; aliases: Mixed, default {} }`. Replaces the flat
  `server/data/skillAliases.json` file entirely.
- **`server/src/services/authTokens.js`** — pure, testable: `hashPassword`,
  `comparePassword` (bcryptjs), `signToken(userId)`, `verifyToken(token)`
  (jsonwebtoken, reads `JWT_SECRET`/`JWT_EXPIRES_IN` from `process.env`).
  Gets `authTokens.test.js` next to it — this is the one new piece of logic
  that fits the codebase's existing "only `services/*.js` get unit tests,
  routes never do" boundary (confirmed zero existing `*.test.js` next to any
  route file).
- **`server/src/middleware/authenticate.js`** (new `middleware/` dir) — reads
  `Authorization: Bearer <token>`, 401 if missing/invalid/expired, sets
  `req.user = { id: payload.sub }`, else `next()`. Stateless — no per-request
  DB lookup. (Tradeoff worth a one-line code comment: a deleted user's token
  stays "valid" until it expires — acceptable, no user-deletion feature
  exists.)
- **`server/src/routes/auth.js`** — `POST /signup`, `POST /login` (generic
  "invalid email or password" on any mismatch, no user-enumeration), `GET
  /me` (protected — used by the frontend to validate a stored token on
  load). No `/logout` route — stateless JWT, logout is just clearing
  `localStorage` client-side. Plus two more, public, for the forgot/reset
  flow:
  - `POST /forgot-password` — body `{email}`. Always responds `200` with a
    generic "if that email exists, a reset link has been sent" message
    regardless of whether the user exists (no enumeration). If the user
    does exist: generate a reset token via `passwordResetTokens.js`, save
    its hash + expiry on the `User` doc, send the email (or console-log the
    link in dev-mode fallback).
  - `POST /reset-password/:token` — body `{password}`. Hashes the incoming
    token, looks up a `User` with a matching, unexpired
    `resetPasswordTokenHash`; 400 ("invalid or expired link") if none found;
    else hashes the new password, saves it, clears the reset fields, and
    responds success.
- **`server/src/services/passwordResetTokens.js`** — `generateResetToken()`
  → `{token, tokenHash, expiresAt}` (a random 32-byte token via
  `crypto.randomBytes`, hashed with plain SHA-256 — not bcrypt; the token
  already has full entropy so bcrypt's deliberate slowness buys nothing and
  only costs CPU) and `hashResetToken(token)` for the lookup side. Small,
  pure, testable — same `services/*.js` boundary as `authTokens.js`.
- **`server/src/services/emailService.js`** — `sendPasswordResetEmail(to,
  resetUrl)` via `nodemailer`. If `SMTP_HOST` is unset, logs the reset URL
  to the console instead of sending (dev-mode fallback, never crashes).

### Backend — modified files

- **`server/src/index.js`**: fail loudly (`process.exit(1)`) at startup if
  `JWT_SECRET` is unset — deliberately *not* the existing "warn and
  continue" style used for `MONGODB_URI`, since a missing/guessable JWT
  secret is a silent security hole, not just a broken feature. Tighten
  `cors()` → `cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' })`.
  Mount `app.use('/api/auth', authRouter)` — public, before any
  `authenticate` middleware. `GET /api/health` stays public.
- **`server/src/routes/applications.js`, `server/src/routes/resumes.js`**:
  `router.use(authenticate)` once at the top of each file (every endpoint in
  both needs a logged-in user — simpler than annotating all 31
  individually). Then the **same ownership pattern everywhere** (described
  once, not per-endpoint):
  - Every `Application`/`MasterResume` `findById`/`findOne` gets `userId:
    req.user.id` folded directly into the query filter — a wrong-owner
    document now comes back `null` from the same query, so the existing
    404-on-null branch handles it for free (404, not 403 — never leak
    whether another user's document exists).
  - The 3 easy-to-miss **collection-level** queries with no `:id` to anchor
    a review pass on: `applications.js`'s `GET /` (list) and `GET
    /export/tracker.xlsx`, and `resumes.js`'s `GET /` (list) — each gets
    `userId: req.user.id` added too.
  - Every `Application`/`MasterResume` `create()` gets `userId: req.user.id`
    added to the payload. `userId` is denormalized directly onto
    `Application` at creation (not just derived via `masterResumeId`), so
    every `Application` route needs one query, not a join back through
    `MasterResume`.
  - `resumes.js`'s `PATCH`/`DELETE /bullets/:id` (bullet id in the path, no
    resume id) is the one place needing a real two-step check:
    `ResumeBullet.findById(id)` then `MasterResume.findOne({_id:
    bullet.masterResumeId, userId: req.user.id})`, 404 if either fails.
  - `resumes.js`'s `PATCH /:id` rename does a global label-uniqueness check
    with no scoping today — add `userId: req.user.id` there too (otherwise
    a second user is wrongly blocked from a label the first user already
    used).
  - Every `graph.invoke(...)` initial-state payload gets `userId:
    req.user.id` added alongside the existing `applicationId`/
    `masterResumeId` fields.
  - Every route-level `canonicalizeSkill`/`computeSkillFrequency`/
    `computeVerifiedSkills` call site gets one `const { aliases, matchers }
    = await getSkillDictionaryForUser(req.user.id)` added before its
    existing (unchanged-shape) usage. (Confirmed consumers: `resumes.js`,
    `canonicalizeSkill.js`, `deterministicVerification.js`,
    `skillFrequency.js` — grep for `getSkillAliases\|getSkillMatchers` to
    catch any others.)
- **`server/src/services/skillAliasesStore.js`**: full rewrite — drop
  `readFileSync`/`writeFileSync`/module-level globals. New exports:
  `async getSkillDictionaryForUser(userId)` → `{aliases, matchers}` (one
  Mongo read via `SkillAliasDictionary.findOne`, matchers built with the
  existing pure `buildSkillMatchers`, unchanged); `async
  addSkillAliasEntriesForUser(userId, proposedGroups)` (keeps the existing
  pure `mergeAliasEntries` unchanged, persists via `findOneAndUpdate({userId},
  ..., {upsert:true})`). Keep `escapeRegex` exported as-is.
- **`server/src/services/canonicalizeSkill.js`, `normalizeSkills.js`,
  `deterministicVerification.js`, `skillFrequency.js`, `verifiedSkills.js`**:
  signature-only change — stop reaching into the module-level global, accept
  the resolved `{aliases, matchers}` (or just `matchers`, matching each
  file's current usage) as an explicit parameter instead. Keeps these pure
  and independently testable, and confines every `await` to exactly one call
  per node/route rather than one Mongo round-trip per skill.
- **`server/src/graph/jobAgentGraph.js`**: add `userId: z.string()` to the
  state schema (next to `applicationId`/`masterResumeId`, same pattern).
  Change `normalizeSkillsNode` (line 186) and `deterministicVerificationNode`
  (line 398) from plain `function` to `async function` — confirmed both are
  currently synchronous — each does one `await getSkillDictionaryForUser(state.userId)`
  at the top, then calls the still-pure `normalizeSkills`/`verifyBullet`/
  `verifySummary` with the resolved dict threaded through.

### Backend — new dependencies / env vars

- `bcryptjs` (pure JS, no native build step — this app has zero native deps
  today, keep it that way), `jsonwebtoken`, `nodemailer`.
- `JWT_SECRET` (required, fail-loud), `JWT_EXPIRES_IN` (default `'30d'` if
  unset — no refresh-token rotation; a single reasonably long-lived token is
  proportionate for this app's real scale, and building revocation/rotation
  now would be disproportionate), `CLIENT_ORIGIN` (default
  `http://localhost:5173`), `RESET_TOKEN_EXPIRES_MS` (default `3600000`, 1
  hour), `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`/`EMAIL_FROM` (all
  optional — unset means dev-mode console-log fallback, not a crash).

### Frontend — new files

- **`client/src/context/AuthContext.jsx`** — first `createContext` in this
  app. Holds `{user, token, loading}`; on mount, if a token exists in
  `localStorage`, calls `GET /api/auth/me` to validate + hydrate `user`
  (renders the existing `HourglassLoader`/`LoadingState` component while
  that resolves — reuse, don't invent a new spinner). Exposes
  `login(email, password)`, `signup(email, password)` (store the token +
  set `user` directly from the response, no extra `/me` round trip),
  `logout()` (clear `localStorage` + state, no server call).
- **`client/src/pages/Login.jsx`, `client/src/pages/Signup.jsx`** — plain
  controlled `useState` inputs (matches this app's existing form pattern
  everywhere — no `react-hook-form` anywhere in the codebase), built from
  existing `components/ui/{input,label,button,card,alert}`. On success,
  `navigate('/applications')`. `Login.jsx` includes a "Forgot password?"
  link to `/forgot-password`.
- **`client/src/pages/ForgotPassword.jsx`** — single email input, calls
  `POST /api/auth/forgot-password`, always shows the same generic
  confirmation message on submit (matches the backend's no-enumeration
  behavior — the UI must not reveal whether the email existed either).
- **`client/src/pages/ResetPassword.jsx`** — route `/reset-password/:token`,
  new-password + confirm-password inputs (client-side match check before
  submit), calls `POST /api/auth/reset-password/:token`. On success,
  redirect to `/login`; on 400 (invalid/expired), show an inline error with
  a link back to `/forgot-password` to request a new one.
- **`client/src/components/ProtectedRoute.jsx`** — reads `AuthContext`;
  `loading` → `LoadingState`; no `user` → `<Navigate to="/login" replace/>`;
  else render `children`.
- **`client/src/lib/apiFetch.js`** — `apiFetch(url, options)`: adds
  `Authorization: Bearer <token>` from `localStorage` if present; on a `401`
  response, clears the token and `window.location.assign('/login')`. Returns
  a plain `Response` (same shape as raw `fetch`) so every existing call
  site's `await res.json()`/`if (!res.ok)` logic is untouched — this is what
  keeps the 27-call-site migration a mechanical find-and-replace rather than
  a rewrite.

### Frontend — modified files

- **`client/src/App.jsx`**: split into two top-level route groups inside
  `<AuthProvider>` — `/login`, `/signup`, `/forgot-password`, and
  `/reset-password/:token` all render standalone (no sidebar); everything
  else (`/*`) is wrapped in `<ProtectedRoute>` around the
  existing inlined Sidebar+`<main>` shell with its nested `<Routes>`
  unchanged. (Smallest possible diff given react-router-dom v7's plain,
  non-data-router usage already in place — no new `Layout.jsx` needed.)
- **`client/src/components/Sidebar.jsx`**: add the logged-in user's email +
  a "Log out" button in the existing `mt-auto border-t ... pt-4` footer area
  — in **both** places it's duplicated today (desktop `<aside>` and the
  mobile `<Dialog>` menu, same as `ThemeToggle`).
- **The 27 raw `fetch()` call sites** (`Approval.jsx` 10, `ResumeBullets.jsx`
  5, `MasterResumes.jsx` 5, `ResumeDetail.jsx` 5, `Applications.jsx` 3,
  `Apply.jsx` 2, `SkillFrequencyCard.jsx` 1, `SearchabilityCheckCard.jsx`
  1): mechanical `fetch(` → `apiFetch(` + import, one line each, identical
  pattern in every file.

## Build order (test-gated)

1. **Schema + deps, no behavior change.** Add `bcryptjs`/`jsonwebtoken`,
   `User.js`, add `userId` (`required: true`) to `MasterResume`/`Application`
   directly — no optional-first staging needed since there's no real data to
   protect from a validation break. Drop/clear the existing
   `masterResumes`/`applications`/`resumeBullets`/`generationCache`
   collections (and delete `server/data/skillAliases.json`) as part of this
   step, since none of it can satisfy the new required field anyway. Confirm
   the app still boots.
2. **`authTokens.js` + its unit test.** Isolated, testable, nothing depends
   on it yet.
3. **`middleware/authenticate.js` + `routes/auth.js` (signup/login/me +
   forgot/reset-password) + `passwordResetTokens.js` + `emailService.js` +
   mount + CORS + fail-loud `JWT_SECRET`.** Manual curl signup → login →
   `/me` round trip, then forgot-password → confirm the reset link is
   console-logged (no SMTP configured yet) → reset-password with that token
   → confirm login works with the new password and fails with the old one.
   Confirm the server refuses to boot with `JWT_SECRET` unset.
4. **Ownership-filter pass on `resumes.js`/`applications.js`** (one pass per
   file, not interleaved with anything else — this is the biggest single
   step, keep it reviewable on its own).
5. **`skillAliasesStore.js` rewrite + the 5 dependent service signature
   changes + the 2 graph-node async conversions + the 6 route call-site
   updates, together** (can't half-migrate this without breaking the graph —
   this is the single riskiest step, touches the graph itself).
6. **Frontend auth plumbing** (`AuthContext`, `apiFetch.js`,
   `Login`/`Signup`/`ForgotPassword`/`ResetPassword`, `ProtectedRoute`,
   `App.jsx`, `Sidebar.jsx`) — build and click through in isolation before
   touching any of the 27 call sites, including the forgot/reset flow
   end-to-end in the browser.
7. **Migrate the 27 fetch call sites**, file by file. Full manual
   click-through of every page (upload a resume, run an application through
   to approval, export) against a fresh signed-up account.
8. **Live E2E** (below).

## Risks / edge cases (confirmed, not just theoretical)

- **Dropping existing collections also drops their LangGraph checkpoint
  threads' referenced documents** (not the checkpoints themselves — those
  live in the checkpointer's own MongoDB collections, separate from
  `applications`). Since every `applications` document is being deleted
  anyway, any orphaned checkpoint state left behind is harmless dead data,
  not a correctness risk — fine to leave it or drop the checkpointer's
  collections too for a fully clean slate.
- **Two tabs, two accounts, same browser**: `localStorage` is per-origin,
  not per-tab — two tabs will fight over one stored token (whichever logs in
  last wins in both). Real but minor UX surprise, not a security issue
  (never cross-account data leakage) — worth knowing, not worth fixing here.
- **`GenerationCache` needs no `userId`**: confirmed — its unique index is
  `{applicationId, nodeName, inputHash, promptVersion, model}`, always
  reached through an already-ownership-checked `Application`, and
  `applicationId` values are globally-unique ObjectIds — no cross-user
  collision surface even in principle.
- **A deleted user's still-valid token**: stateless auth means a token
  survives its full 30-day life even if the `User` were deleted. Not a real
  risk today (no user-deletion feature exists) — worth a one-line comment in
  `authenticate.js` so it isn't mistaken for an oversight later.
- **Resetting a password does not revoke already-issued tokens** — same
  stateless-JWT tradeoff as above, but now more concrete: if an attacker
  already has a valid token, the legitimate user resetting their password
  does *not* lock that attacker out until the token naturally expires. The
  textbook-correct fix is a `tokenVersion` field on `User`, bumped on reset
  and checked by `authenticate` on every request — but that reintroduces a
  per-request DB lookup, which is exactly what the stateless-JWT choice was
  meant to avoid, and is disproportionate at this app's scale. Documenting
  it here rather than silently building it, consistent with the earlier
  no-revocation decision.

## Verification

- `cd server && npm test` after every backend build-order step, not just at
  the end.
- `cd client && npm run lint` (oxlint) and `npm run build` after the
  frontend steps.
- New `authTokens.test.js`: hash/verify round trip, expired-token rejection,
  tampered-signature rejection.
- New `passwordResetTokens.test.js`: token/hash round trip, expiry check.
- Updated (signature changed) tests: `canonicalizeSkill.test.js`,
  `deterministicVerification.test.js`, `skillFrequency.test.js`,
  `verifiedSkills.test.js`, `skillAliasesStore.test.js` — each now passes an
  explicit fixture instead of relying on the old file-backed module load.
- No new route-level tests — matches this codebase's confirmed zero
  route-test-coverage convention; cover the ownership changes via live E2E
  instead:
  1. Sign up two accounts (A, B) via curl. As A, create a resume + an
     application, capture their ids.
  2. As B, `GET` A's resume id and application id directly → assert **404**
     for both (not 403, not 200).
  3. As B, `GET` the list endpoints (`/api/resumes`, `/api/applications`) →
     assert A's documents are absent (this is the check that catches a
     forgotten collection-level query).
  4. Browser (chrome-devtools-mcp), account A: sign up via UI, upload a real
     resume, run an application through to approval, export a
     `.docx`/`tracker.xlsx` — full feature-parity smoke test.
  5. Browser, account B in a second tab: confirm A's data isn't visible
     anywhere; navigate directly to a URL containing A's ids → confirm
     redirect/404, not A's data rendered.
  6. Confirm the per-user skill-alias dictionary actually learns: upload a
     resume containing a new synonym term as account A, confirm it
     canonicalizes correctly, then confirm account B's fresh (empty)
     dictionary does *not* already know that term — proves isolation, not
     just that the write path works.
  7. Forgot/reset password, browser end-to-end: request a reset for account
     A's email, grab the console-logged link (no SMTP configured), open it,
     set a new password, confirm the old password no longer logs in and the
     new one does. Also confirm requesting a reset for a nonexistent email
     shows the same generic message (no enumeration).

## Critical files

- `server/src/middleware/authenticate.js` (new)
- `server/src/services/authTokens.js` (new)
- `server/src/models/User.js`, `server/src/models/SkillAliasDictionary.js` (new)
- `server/src/routes/auth.js` (new — signup/login/me/forgot-password/reset-password)
- `server/src/services/passwordResetTokens.js`, `server/src/services/emailService.js` (new)
- `server/src/services/skillAliasesStore.js` (rewrite)
- `server/src/graph/jobAgentGraph.js` (2 nodes → async, +userId state field)
- `server/src/routes/applications.js`, `server/src/routes/resumes.js`
  (ownership-filter pass)
- `client/src/context/AuthContext.jsx`, `client/src/lib/apiFetch.js` (new)
- `client/src/pages/ForgotPassword.jsx`, `client/src/pages/ResetPassword.jsx` (new)
- `client/src/App.jsx`, `client/src/components/Sidebar.jsx`
