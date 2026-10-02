import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildOutreachEmailMessages, buildResumeContext } from './outreachEmailPrompt.js';

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
  assert.ok(!user.content.includes('qualifications-forward'));
});

test('a Talent & HR contact gets the qualifications-forward framing', () => {
  const [, user] = buildOutreachEmailMessages({
    ...BASE,
    contact: { name: 'Ana Lee', role: 'Talent Partner', category: 'Talent & HR' },
  });
  assert.ok(user.content.includes('qualifications-forward'));
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

test('resume context includes named projects with their description', () => {
  const context = buildResumeContext({
    personalInfo: { fullName: 'Pat Doe' },
    projects: [{ name: 'ResumeStitch AI', description: 'An 11-node LangGraph pipeline.' }],
  });
  assert.ok(context.includes('ResumeStitch AI'));
  assert.ok(context.includes('An 11-node LangGraph pipeline.'));
});

test('resume context says explicitly when no projects are given, rather than staying blank', () => {
  const context = buildResumeContext({ personalInfo: { fullName: 'Pat Doe' } });
  assert.ok(context.includes('(none given)'));
});

test('resume context includes phone and LinkedIn when given, for the signature', () => {
  const context = buildResumeContext({
    personalInfo: { fullName: 'Pat Doe', phone: '+44 7000 000000', linkedin: 'linkedin.com/in/patdoe' },
  });
  assert.ok(context.includes('+44 7000 000000'));
  assert.ok(context.includes('linkedin.com/in/patdoe'));
});

test('company notes are included verbatim in their own tag when given', () => {
  const [, user] = buildOutreachEmailMessages({ ...BASE, companyNotes: 'They build AI agents for contact centers.' });
  assert.ok(user.content.includes('<company_notes>'));
  assert.ok(user.content.includes('They build AI agents for contact centers.'));
});

test('the company_notes tag is omitted entirely when no notes are given', () => {
  const [, user] = buildOutreachEmailMessages({ ...BASE, companyNotes: '' });
  assert.ok(!user.content.includes('<company_notes>'));
});

test('the system message instructs a first-name-only greeting', () => {
  const [system] = buildOutreachEmailMessages(BASE);
  assert.ok(system.content.toLowerCase().includes('first name'));
});

test('the system message instructs one or two concrete accomplishments, never a bulleted list, and a real sign-off', () => {
  const [system] = buildOutreachEmailMessages(BASE);
  assert.ok(system.content.toLowerCase().includes('one or two concrete'));
  assert.ok(system.content.toLowerCase().includes('no bulleted list'));
  assert.ok(system.content.toLowerCase().includes('sign-off'));
});

// Grounded in cold-email research (Hubspot's 40M-email analysis): 50-125
// words maximizes reply rates — our last round of changes drifted the
// other way (bulleted lists, multi-paragraph), which is why real generated
// output started reading as "off." This pins the fix down with a test.
test('the system message gives a concrete, research-backed target word count', () => {
  const [system] = buildOutreachEmailMessages(BASE);
  assert.ok(system.content.includes('80') && system.content.includes('130'));
});

test('the system message bans empty opening pleasantries', () => {
  const [system] = buildOutreachEmailMessages(BASE);
  assert.ok(system.content.toLowerCase().includes('hope this email finds you well'));
});

test('the system message requires a direct, specific ask rather than a vague one', () => {
  const [system] = buildOutreachEmailMessages(BASE);
  assert.ok(system.content.toLowerCase().includes('directly'));
});

// Found live: with no resume linked, the model wrote a literal "[Your Name]"
// placeholder instead of leaving the sign-off bare as instructed.
test('the system message explicitly bans a placeholder name when no resume is linked', () => {
  const [system] = buildOutreachEmailMessages(BASE);
  assert.ok(system.content.toLowerCase().includes('no placeholder'));
});
