# Outreach Email Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user generate a personalized outreach email (subject + body) for one or several selected contacts in the Outreach Tracker, for them to review, edit, and copy — the app never sends anything.

**Architecture:** Two small backend additions (schema fields + a one-shot LLM call behind a per-contact route, no LangGraph, no retry/cache — this isn't the resume-tailoring pipeline) plus a frontend Contacts tab on the existing Outreach Tracker page with selection, a goal picker, and a review/copy panel.

**Tech Stack:** Express + Mongoose (backend), `@langchain/openai` + `zod` structured output (same pattern as `generateCoverLetter.js`), React + existing shadcn/radix `ui/` components (frontend). No new dependencies.

**Spec:** Design doc "Outreach Email Generation — Design & Plan" at https://claude.ai/code/artifact/a24b6782-5667-4e91-b522-fda244d3bf0b (brainstormed 2026-09-28; also summarized in project memory `outreach_email_generation_design.md`).

## Global Constraints

- Draft-only — the app never sends email. Every generated draft is reviewed and copied by the user.
- No fabrication: the generation prompt may only reference the candidate background actually given to it (resume summary/skills when linked) or the typed referral-role text — never invent a skill, achievement, employer, or company fact.
- Stay decoupled from the resume-tailoring LangGraph pipeline (`server/src/graph/`) and from the `applications` collection — no shared state, no new dependency between the two features. A Referral email's "which role" is free text, never linked to an `Application` record (confirmed decision from the brainstorm).
- No new npm dependencies, client or server.
- Don't touch `server/src/graph/`, `server/src/routes/applications.js`, or any resume-tailoring service.
- One assumption being made since the design doc's open comment is still unanswered: `masterResumeId` does **not** auto-default to the user's only resume — it's always an explicit pick (empty by default), the simpler of the two choices on the table. Flagged to the user in the plan hand-off; easy to flip later if they want the other behavior.

---

### Task 1: Schema additions + validation (`masterResumeId`, contact `category`, `lastGeneratedEmail`)

**Files:**
- Modify: `server/src/models/OutreachCompany.js`
- Modify: `server/src/services/validateOutreachCompany.js`
- Test: `server/src/services/validateOutreachCompany.test.js`

**Interfaces:**
- Produces: `CONTACT_CATEGORY_ENUM` (exported array from `validateOutreachCompany.js`, alongside the existing `OUTREACH_RESPONSE_ENUM`), used by Task 4's frontend guess helper and Task 2's prompt builder.
- Produces: `validateOutreachCompany(payload)` now also validates `masterResumeId` (string) and each `contacts[].category` (enum).
- Produces: `normalizeOutreachCompanyPayload(payload)` now also returns `masterResumeId` (trimmed string, `''` if absent) and each contact's `category` (defaults to `'Other'` if missing/invalid).

- [ ] **Step 1: Write the failing tests**

Add to `server/src/services/validateOutreachCompany.test.js` (append — don't remove existing tests):

```js
import {
  validateOutreachCompany,
  normalizeOutreachCompanyPayload,
  CONTACT_CATEGORY_ENUM,
} from './validateOutreachCompany.js';

test('accepts a payload with no masterResumeId at all', () => {
  const { valid } = validateOutreachCompany({ companyName: 'Acme' });
  assert.equal(valid, true);
});

test('rejects a non-string masterResumeId', () => {
  const { valid, errors } = validateOutreachCompany({ companyName: 'Acme', masterResumeId: 42 });
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes('masterResumeId')));
});

test('accepts every valid contact category', () => {
  for (const category of CONTACT_CATEGORY_ENUM) {
    const { valid } = validateOutreachCompany({
      companyName: 'Acme',
      contacts: [{ name: 'Jo', category }],
    });
    assert.equal(valid, true, `expected category "${category}" to be valid`);
  }
});

test('rejects an invalid contact category', () => {
  const { valid, errors } = validateOutreachCompany({
    companyName: 'Acme',
    contacts: [{ name: 'Jo', category: 'Astronaut' }],
  });
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes('category')));
});

test('normalizeOutreachCompanyPayload trims masterResumeId and defaults it to an empty string', () => {
  assert.equal(
    normalizeOutreachCompanyPayload({ companyName: 'Acme', masterResumeId: '  64f0a1b2c3d4e5f6a7b8c9d0  ' }).masterResumeId,
    '64f0a1b2c3d4e5f6a7b8c9d0'
  );
  assert.equal(normalizeOutreachCompanyPayload({ companyName: 'Acme' }).masterResumeId, '');
});

test('normalizeOutreachCompanyPayload defaults an invalid or missing contact category to "Other"', () => {
  const result = normalizeOutreachCompanyPayload({
    companyName: 'Acme',
    contacts: [{ name: 'Jo', category: 'Astronaut' }, { name: 'Ana' }],
  });
  assert.equal(result.contacts[0].category, 'Other');
  assert.equal(result.contacts[1].category, 'Other');
});

test('normalizeOutreachCompanyPayload keeps a valid contact category', () => {
  const result = normalizeOutreachCompanyPayload({
    companyName: 'Acme',
    contacts: [{ name: 'Jo', category: 'Leadership' }],
  });
  assert.equal(result.contacts[0].category, 'Leadership');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && node --test src/services/validateOutreachCompany.test.js`
Expected: FAIL — `CONTACT_CATEGORY_ENUM` is not exported yet, `masterResumeId`/`category` aren't validated or normalized yet.

- [ ] **Step 3: Implement the schema and validation changes**

In `server/src/models/OutreachCompany.js`, add `category` and `lastGeneratedEmail` to `contactSchema`, and `masterResumeId` to the top-level schema:

```js
const contactSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  role: { type: String, trim: true, default: '' },
  email: { type: String, trim: true, default: '' },
  // Sets tone for a generated outreach email. Auto-guessed client-side the
  // moment Role is typed (client/src/lib/guessContactCategory.js), always
  // overridable — never silently trusted. See key-decisions-log.md.
  category: {
    type: String,
    enum: ['Leadership', 'Talent & HR', 'Employee', 'Other'],
    default: 'Other',
  },
  // Only the most recent draft — no version history, since nothing
  // downstream (export, approval) depends on tracking every past
  // generation the way the resume pipeline's tailoredBullets does.
  lastGeneratedEmail: {
    subject: { type: String },
    body: { type: String },
    generatedAt: { type: Date },
  },
});
```

```js
    companyName: { type: String, required: true, trim: true },
    location: { type: String, trim: true, default: '' },
    websiteUrl: { type: String, trim: true, default: '' },
    // Plain string, not a Mongoose ObjectId/ref — looked up manually (with
    // ownership checked) only when actually generating a Speculative email.
    // Keeping it a plain string avoids a CastError when the field is an
    // empty string (the "no resume linked" case), and keeps
    // validateOutreachCompany.js dependency-free.
    masterResumeId: { type: String, trim: true, default: '' },
    contacts: { type: [contactSchema], default: [] },
```

In `server/src/services/validateOutreachCompany.js`:

```js
export const OUTREACH_RESPONSE_ENUM = ['No reply', 'Replied', 'Interview', 'Offer', 'Rejected'];
export const CONTACT_CATEGORY_ENUM = ['Leadership', 'Talent & HR', 'Employee', 'Other'];
```

Add after the `websiteUrl` check:

```js
  if (body.masterResumeId != null && typeof body.masterResumeId !== 'string') {
    errors.push('masterResumeId must be a string.');
  }
```

Add inside the per-contact `forEach`, after the `email` check:

```js
        if (contact.category != null && !CONTACT_CATEGORY_ENUM.includes(contact.category)) {
          errors.push(`contacts[${index}].category must be one of: ${CONTACT_CATEGORY_ENUM.join(', ')}.`);
        }
```

In `normalizeOutreachCompanyPayload`, add `masterResumeId` alongside the other top-level fields and `category` inside the `contacts.map`:

```js
    masterResumeId: String(body.masterResumeId || '').trim(),
```

```js
    contacts: contacts.map((contact) => ({
      name: String(contact?.name || '').trim(),
      role: String(contact?.role || '').trim(),
      email: String(contact?.email || '').trim(),
      category: CONTACT_CATEGORY_ENUM.includes(contact?.category) ? contact.category : 'Other',
    })),
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && node --test src/services/validateOutreachCompany.test.js`
Expected: PASS, all tests (old and new).

- [ ] **Step 5: Run the full backend suite to confirm nothing else broke**

Run: `cd server && npm test`
Expected: PASS, every test (237+ existing, plus the new ones).

- [ ] **Step 6: Commit**

```bash
git add server/src/models/OutreachCompany.js server/src/services/validateOutreachCompany.js server/src/services/validateOutreachCompany.test.js
git commit -m "feat(outreach): add masterResumeId, contact category and lastGeneratedEmail fields"
```

---

### Task 2: Outreach email prompt builder (pure, testable)

**Files:**
- Create: `server/src/services/outreachEmailPrompt.js`
- Test: `server/src/services/outreachEmailPrompt.test.js`

**Interfaces:**
- Produces: `buildOutreachEmailMessages({ goal, referralRole, companyName, contact, resume })` → `[{role:'system', content}, {role:'user', content}]`, consumed by Task 3's `generateOutreachEmail.js`. `contact.category` is expected to be one of Task 1's `CONTACT_CATEGORY_ENUM` values, but this module has no import-time dependency on it — test fixtures below just use the literal strings directly.

Same split this codebase already uses everywhere an LLM is called: the deterministic prompt-assembly logic is a pure, exported, unit-tested function; only the actual `model.invoke(...)` call (Task 3) stays untested, matching `generateCoverLetter.js`, which has no test file of its own for the same reason — a real model call can't be asserted on deterministically.

- [ ] **Step 1: Write the failing tests**

Create `server/src/services/outreachEmailPrompt.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildOutreachEmailMessages } from './outreachEmailPrompt.js';

const BASE = {
  goal: 'speculative',
  referralRole: '',
  companyName: 'Acme Corp',
  contact: { name: 'Jo Smith', role: 'CTO', category: 'Leadership' },
  resume: null,
};

test('returns exactly one system message and one user message', () => {
  const messages = buildOutreachEmailMessages(BASE);
  assert.equal(messages.length, 2);
  assert.equal(messages[0].role, 'system');
  assert.equal(messages[1].role, 'user');
});

test('the system message forbids inventing facts and filler phrases', () => {
  const [system] = buildOutreachEmailMessages(BASE);
  assert.ok(system.content.includes('never invent'));
});

test('a Leadership contact gets vision/impact framing, not the Talent & HR framing', () => {
  const [, user] = buildOutreachEmailMessages(BASE);
  assert.ok(user.content.includes('vision'));
  assert.ok(!user.content.includes('mini cover letter'));
});

test('a Talent & HR contact gets the qualifications-pitch framing', () => {
  const [, user] = buildOutreachEmailMessages({
    ...BASE,
    contact: { name: 'Ana Lee', role: 'Talent Partner', category: 'Talent & HR' },
  });
  assert.ok(user.content.includes('mini cover letter'));
});

test('an unrecognized category falls back to the Other/neutral framing, not a crash', () => {
  const [, user] = buildOutreachEmailMessages({
    ...BASE,
    contact: { name: 'Sam Park', role: 'Something', category: 'Not A Real Category' },
  });
  assert.ok(user.content.includes('neutral'));
});

test('a speculative goal asks about a current opening or future consideration', () => {
  const [, user] = buildOutreachEmailMessages(BASE);
  assert.ok(user.content.toLowerCase().includes('open role'));
  assert.ok(user.content.toLowerCase().includes('kept in mind'));
});

test('a referral goal includes the typed referral role and omits the speculative framing', () => {
  const [, user] = buildOutreachEmailMessages({
    ...BASE,
    goal: 'referral',
    referralRole: 'the Backend Engineer position',
  });
  assert.ok(user.content.includes('the Backend Engineer position'));
  assert.ok(user.content.includes('referral_role'));
});

test('with no resume linked, the candidate background says so explicitly rather than staying blank', () => {
  const [, user] = buildOutreachEmailMessages(BASE);
  assert.ok(user.content.includes('no resume linked'));
});

test('with a resume linked, its summary and skills are included verbatim', () => {
  const [, user] = buildOutreachEmailMessages({
    ...BASE,
    resume: {
      personalInfo: { fullName: 'Pat Doe', title: 'Full-Stack Engineer' },
      summary: 'Five years building web apps.',
      skills: ['React', 'Node.js', 'PostgreSQL'],
    },
  });
  assert.ok(user.content.includes('Pat Doe'));
  assert.ok(user.content.includes('Five years building web apps.'));
  assert.ok(user.content.includes('React'));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && node --test src/services/outreachEmailPrompt.test.js`
Expected: FAIL — the module doesn't exist yet.

- [ ] **Step 3: Write the implementation**

Create `server/src/services/outreachEmailPrompt.js`:

```js
// Tone instructions keyed by the contact's category — one flexible prompt
// with conditional instructions per goal×category, not six hardcoded
// templates, same "instructions over branching" style as tailorContent.js.
const CATEGORY_TONE_GUIDANCE = {
  Leadership:
    'Address them as a founder or senior executive. Frame the message around vision and impact — why this ' +
    'company specifically, and what the candidate could contribute at a high level. Keep it concise and confident.',
  'Talent & HR':
    'Address them as a recruiter or talent professional. Frame the message as a compressed qualifications ' +
    'pitch, like a mini cover letter, oriented around role fit and next steps.',
  Employee:
    'Address them as a peer individual contributor. Keep the tone casual and curious, peer-to-peer, not a formal pitch.',
  Other:
    "Keep the tone neutral and professional, similar to writing to a recruiter, since this contact's exact role isn't known.",
};

const GOAL_INSTRUCTIONS = {
  speculative:
    'The candidate wants to know whether this company has an open role for them right now, or if not, to be ' +
    'kept in mind for a future opening. Write one message that naturally covers both — never send this as two ' +
    'separate asks.',
  referral:
    'The candidate has already applied to a specific role elsewhere at this company and is asking this contact ' +
    'to flag or refer that application internally. The exact role is given below as <referral_role> — reference ' +
    'it by name.',
};

export function buildResumeContext(resume) {
  if (!resume) {
    return '(no resume linked — keep the email general, do not invent specific skills or achievements)';
  }
  const skills = (resume.skills || []).slice(0, 8).join(', ');
  return [
    `Name: ${resume.personalInfo?.fullName || '(not given)'}`,
    `Title: ${resume.personalInfo?.title || '(not given)'}`,
    `Summary: ${resume.summary || '(not given)'}`,
    `Key skills: ${skills || '(not given)'}`,
  ].join('\n');
}

/**
 * Builds the two chat messages for one outreach email generation call.
 * Pure and deterministic — no LLM call here, see generateOutreachEmail.js.
 */
export function buildOutreachEmailMessages({ goal, referralRole, companyName, contact, resume }) {
  const toneGuidance = CATEGORY_TONE_GUIDANCE[contact.category] || CATEGORY_TONE_GUIDANCE.Other;
  const goalInstruction = GOAL_INSTRUCTIONS[goal] || GOAL_INSTRUCTIONS.speculative;

  return [
    {
      role: 'system',
      content:
        'Write a short outreach email a job-seeker can send to one specific contact at a company. Use ONLY the ' +
        'candidate background given below — never invent a skill, achievement, employer, or fact about the ' +
        'candidate or the company. No filler phrases ("results-driven", "proven track record"), no first-person ' +
        'pronoun in the subject line, no address block or signature scaffolding in the body — end the body with ' +
        'just a sign-off line like "Best," with no name after it, since the real name is added by the sender afterward.',
    },
    {
      role: 'user',
      content:
        `<goal>\n${goalInstruction}\n</goal>\n\n` +
        (goal === 'referral' ? `<referral_role>\n${referralRole || '(not given)'}\n</referral_role>\n\n` : '') +
        `<contact>\nName: ${contact.name}\nRole: ${contact.role || '(not given)'}\n</contact>\n\n` +
        `<tone>\n${toneGuidance}\n</tone>\n\n` +
        `<company_name>\n${companyName}\n</company_name>\n\n` +
        `<candidate_background>\n${buildResumeContext(resume)}\n</candidate_background>`,
    },
  ];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && node --test src/services/outreachEmailPrompt.test.js`
Expected: PASS, all 9 tests.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/outreachEmailPrompt.js server/src/services/outreachEmailPrompt.test.js
git commit -m "feat(outreach): add pure prompt builder for outreach email generation"
```

---

### Task 3: Generation service + route

**Files:**
- Create: `server/src/services/generateOutreachEmail.js`
- Modify: `server/src/routes/outreach.js`

**Interfaces:**
- Consumes: `buildOutreachEmailMessages` from Task 2.
- Produces: `generateOutreachEmail({ goal, referralRole, companyName, contact, resume })` → `Promise<{ subject, body }>`, used by the new route below.

No `GenerationCache` here, unlike the resume pipeline's LLM-calling nodes — this isn't a retried/checkpointed pipeline, it's a single manual action the user triggers once per contact and reviews immediately, matching the design doc's Non-Goals (no full version history, no idempotency machinery needed).

This task has no automated test of its own, for the same reason `generateCoverLetter.js` has none — the only thing left to test is the real model call. Verified manually in Step 4.

- [ ] **Step 1: Write the generation service**

Create `server/src/services/generateOutreachEmail.js`:

```js
import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';
import { buildOutreachEmailMessages } from './outreachEmailPrompt.js';

const OUTREACH_EMAIL_MODEL = 'gpt-4o-mini';

const outreachEmailSchema = z.object({
  subject: z.string().describe('A short, specific email subject line, under 80 characters.'),
  body: z.string().describe('The full email body, at most 3 short paragraphs, no address block or signature scaffolding.'),
});

const model = new ChatOpenAI({ model: OUTREACH_EMAIL_MODEL, temperature: 0.3 }).withStructuredOutput(
  outreachEmailSchema,
  { name: 'generate_outreach_email', strict: true }
);

export async function generateOutreachEmail({ goal, referralRole, companyName, contact, resume }) {
  const messages = buildOutreachEmailMessages({ goal, referralRole, companyName, contact, resume });
  const result = await model.invoke(messages);
  return { subject: result.subject, body: result.body };
}
```

- [ ] **Step 2: Add the route**

In `server/src/routes/outreach.js`, add these imports at the top:

```js
import MasterResume from '../models/MasterResume.js';
import { generateOutreachEmail } from '../services/generateOutreachEmail.js';
```

Add this route before `export default router;`:

```js
// One-shot, draft-only generation — nothing is ever sent by the app. See
// key-decisions-log.md for why this has no GenerationCache, unlike the
// resume pipeline's LLM nodes.
router.post('/:id/contacts/:contactId/generate-email', async (req, res) => {
  const { id, contactId } = req.params;
  if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(contactId)) {
    return res.status(400).json({ error: 'Invalid outreach company or contact id.' });
  }

  const { goal, referralRole } = req.body;
  if (!['speculative', 'referral'].includes(goal)) {
    return res.status(400).json({ error: 'goal must be "speculative" or "referral".' });
  }
  if (goal === 'referral' && (typeof referralRole !== 'string' || !referralRole.trim())) {
    return res.status(400).json({ error: 'referralRole is required when goal is "referral".' });
  }

  try {
    const company = await OutreachCompany.findOne({ _id: id, userId: req.user.id });
    if (!company) return res.status(404).json({ error: 'Outreach company not found.' });

    const contact = company.contacts.find((c) => String(c._id) === contactId);
    if (!contact) return res.status(404).json({ error: 'Contact not found on this company.' });

    // Graceful degradation: a stale/invalid link (e.g. the linked resume was
    // since deleted) just means no resume context, not a failed request.
    let resume = null;
    if (company.masterResumeId && mongoose.isValidObjectId(company.masterResumeId)) {
      resume = await MasterResume.findOne({ _id: company.masterResumeId, userId: req.user.id });
    }

    const { subject, body } = await generateOutreachEmail({
      goal,
      referralRole: referralRole ? referralRole.trim() : '',
      companyName: company.companyName,
      contact: { name: contact.name, role: contact.role, category: contact.category },
      resume,
    });

    contact.lastGeneratedEmail = { subject, body, generatedAt: new Date() };
    await company.save();

    return res.json({ subject, body });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to generate this email.' });
  }
});
```

- [ ] **Step 3: Run the full backend suite**

Run: `cd server && npm test`
Expected: PASS — this task adds no tests of its own, so this just confirms the new route file still parses and nothing existing regressed.

- [ ] **Step 4: Manual verification (requires a real OpenAI key in `server/.env`)**

Start the backend (`cd server && npm run dev`), log in, create (or reuse) an outreach company with at least one contact, then:

```bash
curl -s -X POST http://localhost:5000/api/outreach/<companyId>/contacts/<contactId>/generate-email \
  -H "Authorization: Bearer <your JWT>" \
  -H "Content-Type: application/json" \
  -d '{"goal":"speculative"}'
```

Expected: `200` with `{ "subject": "...", "body": "..." }`; re-fetching that company (`GET /api/outreach/:id`) shows `lastGeneratedEmail` populated on that contact. Repeat once with `{"goal":"referral","referralRole":"the Backend Engineer position"}` and confirm the body actually references that role.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/generateOutreachEmail.js server/src/routes/outreach.js
git commit -m "feat(outreach): add one-shot outreach email generation route"
```

---

### Task 4: Contact category control (frontend)

**Files:**
- Create: `client/src/lib/guessContactCategory.js`
- Modify: `client/src/components/ContactsFieldArray.jsx`

**Interfaces:**
- Produces: `CONTACT_CATEGORIES` (array) and `guessContactCategory(role)` (pure function), used by `ContactsFieldArray.jsx` (this task) and by Task 6's generation dialog if it needs to display a contact's category.

No automated test — this client has no test runner configured at all (confirmed: `client/package.json` has no `"test"` script, and no existing frontend logic in this app has a unit test). Verified manually in Step 3, consistent with how every other client-only helper in this codebase (`rowClassName`, `safeWebsiteUrl`, etc.) is verified.

This keyword list is a small, deliberate duplication of the enum already defined server-side in `validateOutreachCompany.js` — there's no shared package between `client/` and `server/` in this repo (two independent `package.json`s), so duplicating a 4-item list is simpler than building shared-package tooling for it. The category a contact ends up with on save still goes through the server's own `CONTACT_CATEGORY_ENUM` validation regardless of what the client guessed.

- [ ] **Step 1: Write the guess helper**

Create `client/src/lib/guessContactCategory.js`:

```js
// Deliberately duplicated from server/src/services/validateOutreachCompany.js's
// CONTACT_CATEGORY_ENUM — no shared package exists between client/ and
// server/ in this repo, so a 4-item list is simpler to keep in sync by hand
// than to add shared-package tooling for. The value picked here is only ever
// a starting suggestion — the server validates whatever is actually saved.
export const CONTACT_CATEGORIES = ['Leadership', 'Talent & HR', 'Employee', 'Other'];

// Same "explicit short hand-list, not a broad pattern" precedent as
// SENIORITY_QUALIFIER_TERMS in suggestResumeTitle.js on the backend.
const LEADERSHIP_TERMS = ['founder', 'co-founder', 'ceo', 'cto', 'coo', 'cfo', 'president', 'chief', 'vp', 'vice president'];
const TALENT_TERMS = ['talent', 'recruit', 'hr', 'human resources', 'people'];

export function guessContactCategory(role) {
  const normalized = (role || '').toLowerCase();
  if (!normalized.trim()) return 'Other';
  if (LEADERSHIP_TERMS.some((term) => normalized.includes(term))) return 'Leadership';
  if (TALENT_TERMS.some((term) => normalized.includes(term))) return 'Talent & HR';
  return 'Employee';
}
```

- [ ] **Step 2: Wire it into `ContactsFieldArray.jsx`**

Replace the full contents of `client/src/components/ContactsFieldArray.jsx`:

```jsx
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CONTACT_CATEGORIES, guessContactCategory } from "@/lib/guessContactCategory.js";

// Fully controlled by the parent dialog's local state — never calls an API
// itself. Each contact is `{ _id?, name, role, email, category, categoryTouched? }`;
// `_id` and `categoryTouched` are UI-only, never sent to the server
// (normalizeOutreachCompanyPayload strips anything outside its own field
// list). `categoryTouched` tracks whether the user has ever picked a
// category by hand for this contact — while false, typing into Role
// re-guesses the category; once the dropdown is used directly, the guess
// never overwrites it again. Deliberately not built on EditableEntryList.jsx,
// since that component saves each array change immediately via its own API
// call, while this array must be held in the parent's state and submitted
// once with the rest of the company form.
export function ContactsFieldArray({ contacts, onChange }) {
  function updateField(index, field, value) {
    onChange(
      contacts.map((contact, i) => {
        if (i !== index) return contact;
        const next = { ...contact, [field]: value };
        if (field === "role" && !contact.categoryTouched) {
          next.category = guessContactCategory(value);
        }
        return next;
      })
    );
  }
  function updateCategory(index, value) {
    onChange(contacts.map((contact, i) => (i === index ? { ...contact, category: value, categoryTouched: true } : contact)));
  }
  function addContact() {
    onChange([...contacts, { name: "", role: "", email: "", category: "Other", categoryTouched: false }]);
  }
  function removeContact(index) {
    onChange(contacts.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Label>Contacts</Label>
        <Button type="button" size="sm" variant="outline" onClick={addContact}>
          <Plus className="size-4" /> Add person
        </Button>
      </div>

      {contacts.length === 0 && <p className="text-sm text-muted-foreground">No contacts added yet.</p>}

      {contacts.map((contact, index) => (
        <div key={contact._id || `new-${index}`} className="flex flex-col gap-2 rounded-md border border-border p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Person {index + 1}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="-my-1.5 text-muted-foreground hover:text-destructive"
              onClick={() => removeContact(index)}
              aria-label={`Remove contact ${index + 1}`}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
          <Input
            placeholder="Name"
            aria-label={`Contact ${index + 1} name`}
            value={contact.name}
            onChange={(event) => updateField(index, "name", event.target.value)}
          />
          <div className="flex gap-2">
            <Input
              placeholder="Role (e.g. CTO)"
              aria-label={`Contact ${index + 1} role`}
              value={contact.role}
              onChange={(event) => updateField(index, "role", event.target.value)}
              className="flex-1"
            />
            <Select value={contact.category || "Other"} onValueChange={(value) => updateCategory(index, value)}>
              <SelectTrigger className="w-36 shrink-0" aria-label={`Contact ${index + 1} category`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTACT_CATEGORIES.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Input
            type="email"
            placeholder="Email"
            aria-label={`Contact ${index + 1} email`}
            value={contact.email}
            onChange={(event) => updateField(index, "email", event.target.value)}
          />
        </div>
      ))}
    </div>
  );
}
```

Note: existing contacts loaded from the server (via `openEdit` in `OutreachTracker.jsx`) need `categoryTouched: true` set so editing their Role afterward doesn't silently re-guess a category that was already deliberately set or previously saved — this is wired in Task 5's `openEdit` update, not here.

- [ ] **Step 3: Manual verification**

Run `cd client && npm run build` to confirm it compiles. Then in the running app: open "Add company," click "Add person," type a role like "Founder" into Role and confirm the Category dropdown jumps to "Leadership" automatically; type "Talent Partner" on a second person and confirm it becomes "Talent & HR"; manually change a category via the dropdown, then keep editing that same person's Role, and confirm the category does **not** snap back to a guess afterward.

- [ ] **Step 4: Commit**

```bash
git add client/src/lib/guessContactCategory.js client/src/components/ContactsFieldArray.jsx
git commit -m "feat(outreach): auto-guess contact category from role, with manual override"
```

---

### Task 5: Resume link + Contacts tab (frontend)

**Files:**
- Modify: `client/src/pages/OutreachTracker.jsx`

**Interfaces:**
- Consumes: `RESUMES_API` from `client/src/lib/api.js` (already exported, used elsewhere by `Applications.jsx`).
- Produces: a `masterResumes` state list and a flattened `allContacts` derived list, both consumed by Task 6's generation panel in the same file.

- [ ] **Step 1: Fetch master resumes and add the link field to the company form**

In `OutreachTracker.jsx`, add to the imports:

```jsx
import { OUTREACH_API, RESUMES_API } from "../lib/api.js";
```

Add `masterResumeId: ""` to `EMPTY_FORM`. Add a `masterResumes` state and load it once, mirroring `Applications.jsx`'s own `loadMasterResumes` effect:

```jsx
const [masterResumes, setMasterResumes] = useState([]);

useEffect(() => {
  async function loadMasterResumes() {
    try {
      const res = await apiFetch(RESUMES_API);
      const data = await res.json();
      if (res.ok) setMasterResumes(data.masterResumes || []);
    } catch {
      // Non-fatal — the resume-link dropdown just won't have options.
    }
  }
  loadMasterResumes();
}, []);
```

In `openEdit`, add `masterResumeId: company.masterResumeId || ""` to the `setForm(...)` object, and mark every loaded contact as already-categorized so editing its Role later doesn't silently re-guess:

```jsx
      contacts: (company.contacts || []).map((contact) => ({
        _id: contact._id,
        name: contact.name,
        role: contact.role || "",
        email: contact.email || "",
        category: contact.category || "Other",
        categoryTouched: true,
      })),
```

In the Add/Edit dialog JSX, add a Resume-link `Select` right after the Website field:

```jsx
<div className="flex flex-col gap-1.5">
  <Label>Resume (optional, used for AI email generation)</Label>
  <Select
    value={form.masterResumeId || "none"}
    onValueChange={(value) => setForm((prev) => ({ ...prev, masterResumeId: value === "none" ? "" : value }))}
  >
    <SelectTrigger>
      <SelectValue placeholder="No resume linked" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="none">No resume linked</SelectItem>
      {masterResumes.map((resume) => (
        <SelectItem key={resume._id} value={resume._id}>
          {resume.personalInfo?.fullName || resume.label}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>
```

- [ ] **Step 2: Add the Companies/Contacts tabs and the flattened Contacts table**

Add to the imports:

```jsx
import { Mail } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
```

Add state for the active tab and contact selection, and a derived flattened list, right after the existing state declarations:

```jsx
const [activeTab, setActiveTab] = useState("companies");
const [selectedContactKeys, setSelectedContactKeys] = useState(new Set());

const allContacts = companies.flatMap((company) =>
  (company.contacts || []).map((contact) => ({
    key: `${company._id}:${contact._id}`,
    companyId: company._id,
    companyName: company.companyName,
    contactId: contact._id,
    name: contact.name,
    role: contact.role,
    category: contact.category || "Other",
  }))
);

function toggleContact(key) {
  setSelectedContactKeys((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });
}
```

Wrap the existing header block, filter row, states, and the companies `<table>` in a `Tabs` component — the structural change is: everything that currently renders unconditionally between the header `<div>` and the two `<Dialog>`s at the end becomes the `companies` tab's content, and a new `TabsContent value="contacts"` sibling holds the flattened table. Add this right after the page's intro paragraph (`Every company you've emailed directly...`) and before the search/filter row:

```jsx
<Tabs value={activeTab} onValueChange={setActiveTab} className="mb-5">
  <TabsList>
    <TabsTrigger value="companies">Companies</TabsTrigger>
    <TabsTrigger value="contacts">Contacts ({allContacts.length})</TabsTrigger>
  </TabsList>
</Tabs>
```

Then wrap the search/filter row through the companies `<table>` block (everything from `{(companies.length > 0 || hasActiveFilters) && (...)}` down through the closing of the companies `{!loading && companies.length > 0 && (...)}` block) inside:

```jsx
{activeTab === "companies" && (
  <>
    {/* ...existing search/filter row, error/loading/empty states, and companies table, unchanged... */}
  </>
)}

{activeTab === "contacts" && (
  <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-card">
    {allContacts.length === 0 ? (
      <EmptyState
        icon={Mail}
        title="No contacts yet"
        description="Add a contact to one of your companies first, then come back here to generate outreach emails."
      />
    ) : (
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-card">
          <tr className="border-b border-border">
            <th scope="col" className="w-10 py-3 pl-4" aria-hidden="true" />
            <th scope="col" className="py-3 pl-2 text-left font-mono text-[11px] font-medium tracking-wide text-ink-faint uppercase">Name</th>
            <th scope="col" className="py-3 pl-4 text-left font-mono text-[11px] font-medium tracking-wide text-ink-faint uppercase">Role</th>
            <th scope="col" className="py-3 pl-4 text-left font-mono text-[11px] font-medium tracking-wide text-ink-faint uppercase">Category</th>
            <th scope="col" className="py-3 pl-4 text-left font-mono text-[11px] font-medium tracking-wide text-ink-faint uppercase">Company</th>
          </tr>
        </thead>
        <tbody>
          {allContacts.map((contact) => (
            <tr key={contact.key} className="border-b border-border last:border-0">
              <td className="py-3 pl-4">
                <Checkbox
                  checked={selectedContactKeys.has(contact.key)}
                  onCheckedChange={() => toggleContact(contact.key)}
                  aria-label={`Select ${contact.name}`}
                />
              </td>
              <td className="py-3 pl-2 font-medium text-foreground">{contact.name}</td>
              <td className="py-3 pl-4 text-foreground">{contact.role || <span className="text-muted-foreground">—</span>}</td>
              <td className="py-3 pl-4 text-foreground">{contact.category}</td>
              <td className="py-3 pl-4 text-foreground">{contact.companyName}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </div>
)}
```

(Task 6 adds the "Generate emails" button and review panel into this same `activeTab === "contacts"` block.)

- [ ] **Step 2b: Guard the companies tab's own early-returns**

Since the companies tab's loading/empty states (`{loading && ...}`, the two `{!loading && companies.length === 0 ...}` blocks) currently render regardless of tab, wrap each of those three blocks' conditions with `activeTab === "companies" &&` so they don't also show while the Contacts tab is active. Example for the loading state: change `{loading && <LoadingState .../>}` to `{activeTab === "companies" && loading && <LoadingState .../>}`, and the same pattern for the two empty-state blocks and the companies table's own `{!loading && companies.length > 0 && (...)}` condition (equivalent to Step 2's wrapping — if Step 2 already wrapped the whole section in `{activeTab === "companies" && (<>...</>)}`, this sub-step is already satisfied and can be skipped).

- [ ] **Step 3: Manual verification**

Run `cd client && npm run build` to confirm it compiles with no errors. In the running app: confirm the Companies tab still works exactly as before (unaffected); switch to the Contacts tab and confirm every contact from every company appears with its category; check a couple of checkboxes and confirm they stay checked while switching tabs and back; open a company's Edit dialog and confirm the new Resume dropdown lists your actual master resumes and saves correctly (reopen it after saving to confirm the selection persisted).

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/OutreachTracker.jsx
git commit -m "feat(outreach): add resume link field and a cross-company Contacts tab"
```

---

### Task 6: Generate + review/copy panel (frontend)

**Files:**
- Modify: `client/src/pages/OutreachTracker.jsx`

**Interfaces:**
- Consumes: `selectedContactKeys`, `allContacts` from Task 5; `OUTREACH_API` from `client/src/lib/api.js`; the `POST /:id/contacts/:contactId/generate-email` route from Task 3.

- [ ] **Step 1: Add generation state and the sequential generation function**

Add state, right after `selectedContactKeys`:

```jsx
const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
const [generateGoal, setGenerateGoal] = useState("speculative");
const [referralRole, setReferralRole] = useState("");
const [generating, setGenerating] = useState(false);
const [generateError, setGenerateError] = useState("");
const [drafts, setDrafts] = useState([]); // [{ key, companyName, contactName, subject, body, copied, error }]
```

Add the generation function (sequential, not `Promise.all` — a deliberate choice to avoid bursting several LLM calls at once for what's meant to be a manual, reviewed-as-you-go action; also means one failing contact doesn't abort the rest):

```jsx
async function generateEmails() {
  if (generateGoal === "referral" && !referralRole.trim()) {
    setGenerateError("Enter which role this referral is for.");
    return;
  }
  setGenerating(true);
  setGenerateError("");

  const targets = allContacts.filter((contact) => selectedContactKeys.has(contact.key));
  const results = [];
  for (const contact of targets) {
    try {
      const res = await apiFetch(`${OUTREACH_API}/${contact.companyId}/contacts/${contact.contactId}/generate-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: generateGoal, referralRole: referralRole.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't generate this email.");
      results.push({
        key: contact.key,
        companyName: contact.companyName,
        contactName: contact.name,
        subject: data.subject,
        body: data.body,
        copied: false,
        error: "",
      });
    } catch (err) {
      results.push({
        key: contact.key,
        companyName: contact.companyName,
        contactName: contact.name,
        subject: "",
        body: "",
        copied: false,
        error: err.message,
      });
    }
  }

  setDrafts(results);
  setGenerating(false);
  setGenerateDialogOpen(false);
}

function updateDraft(key, field, value) {
  setDrafts((prev) => prev.map((draft) => (draft.key === key ? { ...draft, [field]: value, copied: false } : draft)));
}

async function copyDraft(key) {
  const draft = drafts.find((d) => d.key === key);
  if (!draft) return;
  await navigator.clipboard.writeText(`Subject: ${draft.subject}\n\n${draft.body}`);
  setDrafts((prev) => prev.map((d) => (d.key === key ? { ...d, copied: true } : d)));
}
```

- [ ] **Step 2: Add the "Generate emails" trigger and dialog**

Inside the `activeTab === "contacts"` block from Task 5, right before the contacts `<table>`'s wrapping `<div>`, add a toolbar:

```jsx
<div className="mb-3 flex items-center justify-between">
  <p className="text-sm text-muted-foreground">
    {selectedContactKeys.size} selected
  </p>
  <Button size="sm" disabled={selectedContactKeys.size === 0} onClick={() => setGenerateDialogOpen(true)}>
    <Mail className="size-4" /> Generate emails
  </Button>
</div>
```

Add the goal-picker dialog near the page's other `<Dialog>`s:

```jsx
<Dialog open={generateDialogOpen} onOpenChange={(open) => !generating && setGenerateDialogOpen(open)}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Generate {selectedContactKeys.size} email{selectedContactKeys.size === 1 ? "" : "s"}</DialogTitle>
      <DialogDescription>
        Drafts only — nothing is sent. You'll review and copy each one yourself.
      </DialogDescription>
    </DialogHeader>

    {generateError && (
      <Alert variant="destructive">
        <AlertDescription>{generateError}</AlertDescription>
      </Alert>
    )}

    <div className="flex flex-col gap-1.5">
      <Label>Goal</Label>
      <Select value={generateGoal} onValueChange={setGenerateGoal}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="speculative">Speculative — ask about a role, or to be kept in mind</SelectItem>
          <SelectItem value="referral">Referral — ask about a role already applied to elsewhere</SelectItem>
        </SelectContent>
      </Select>
    </div>

    {generateGoal === "referral" && (
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="referral-role">Which role</Label>
        <Input
          id="referral-role"
          value={referralRole}
          onChange={(event) => setReferralRole(event.target.value)}
          placeholder="e.g. the Backend Engineer position"
        />
      </div>
    )}

    <DialogFooter>
      <Button variant="ghost" onClick={() => setGenerateDialogOpen(false)} disabled={generating}>
        Cancel
      </Button>
      <Button onClick={generateEmails} disabled={generating}>
        {generating ? "Generating…" : "Generate"}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

- [ ] **Step 3: Add the review/edit/copy panel**

Add this block right after the generate dialog — it renders as a section on the page (not another dialog), so multiple drafts can be reviewed side by side without re-opening anything:

```jsx
{drafts.length > 0 && (
  <div className="mt-6 flex flex-col gap-4">
    <div className="flex items-center justify-between">
      <h2 className="font-display text-lg font-semibold text-foreground">Generated drafts</h2>
      <Button variant="ghost" size="sm" onClick={() => setDrafts([])}>
        Clear
      </Button>
    </div>
    {drafts.map((draft) => (
      <div key={draft.key} className="rounded-lg border border-border bg-card p-4 shadow-card">
        <p className="mb-2 text-sm font-medium text-foreground">
          {draft.contactName} <span className="text-muted-foreground">· {draft.companyName}</span>
        </p>
        {draft.error ? (
          <Alert variant="destructive">
            <AlertDescription>{draft.error}</AlertDescription>
          </Alert>
        ) : (
          <div className="flex flex-col gap-2">
            <Input
              value={draft.subject}
              onChange={(event) => updateDraft(draft.key, "subject", event.target.value)}
              aria-label={`Subject for ${draft.contactName}`}
            />
            <Textarea
              rows={6}
              value={draft.body}
              onChange={(event) => updateDraft(draft.key, "body", event.target.value)}
              aria-label={`Body for ${draft.contactName}`}
            />
            <Button size="sm" variant="outline" className="w-fit" onClick={() => copyDraft(draft.key)}>
              {draft.copied ? "Copied!" : "Copy"}
            </Button>
          </div>
        )}
      </div>
    ))}
  </div>
)}
```

- [ ] **Step 4: Manual verification**

Run `cd client && npm run build` to confirm it compiles. In the running app, on the Contacts tab: select 2-3 contacts spanning different categories (e.g. one Leadership, one Talent & HR) and, ideally, more than one company; click "Generate emails," pick Speculative, generate, and confirm one draft card appears per selected contact with a noticeably different tone between the Leadership and Talent & HR drafts; edit a draft's body text and click Copy, then paste somewhere to confirm the clipboard actually has `Subject: ...` followed by the edited body; repeat with Referral and a typed role, and confirm the generated text actually references that role by name; select a contact whose company has no linked resume and confirm generation still succeeds (general, not fabricated-sounding wording).

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/OutreachTracker.jsx
git commit -m "feat(outreach): add generate/review/copy panel for outreach emails"
```

---

## Final Verification

- [ ] Run `cd server && npm test` — full suite passes (existing + all new tests from Tasks 1–2).
- [ ] Run `cd client && npm run build` — compiles with no new errors (the pre-existing `set-state-in-effect` lint warning on this page is expected and unrelated).
- [ ] Full manual walkthrough: add a company with a linked resume and 3 contacts (one of each category: Leadership, Talent & HR, Employee) → switch to the Contacts tab → select all three → generate Speculative emails → confirm all three tones genuinely differ → edit and copy one → generate a Referral email for one contact with a typed role → confirm the role is referenced → confirm nothing was ever sent, only copied.
- [ ] Update `key-decisions-log.md` with the real decisions made during implementation (the sequential-not-parallel generation choice, the no-GenerationCache choice, the plain-string-not-ObjectId `masterResumeId` choice, the client-side-duplicated category keyword list) — follow this repo's existing convention of recording *why*, not just *what*.
