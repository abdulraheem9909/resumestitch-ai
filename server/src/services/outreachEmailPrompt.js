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
    return '(no resume linked — keep the email general, do not invent specific skills, achievements, projects, or contact details)';
  }
  const skills = (resume.skills || []).slice(0, 8).join(', ');
  const projects = (resume.projects || [])
    .filter((project) => project?.name)
    .map((project) => `- ${project.name}: ${project.description || '(no description given)'}`)
    .join('\n');
  return [
    `Name: ${resume.personalInfo?.fullName || '(not given)'}`,
    `Title: ${resume.personalInfo?.title || '(not given)'}`,
    `Phone: ${resume.personalInfo?.phone || '(not given)'}`,
    `LinkedIn: ${resume.personalInfo?.linkedin || '(not given)'}`,
    `Summary: ${resume.summary || '(not given)'}`,
    `Key skills: ${skills || '(not given)'}`,
    `Notable projects:\n${projects || '(none given)'}`,
  ].join('\n');
}

/**
 * Builds the two chat messages for one outreach email generation call.
 * Pure and deterministic — no LLM call here, see generateOutreachEmail.js.
 */
export function buildOutreachEmailMessages({ goal, referralRole, companyName, companyNotes, contact, resume }) {
  const toneGuidance = CATEGORY_TONE_GUIDANCE[contact.category] || CATEGORY_TONE_GUIDANCE.Other;
  const goalInstruction = GOAL_INSTRUCTIONS[goal] || GOAL_INSTRUCTIONS.speculative;
  const notes = (companyNotes || '').trim();

  return [
    {
      role: 'system',
      content:
        'Write an outreach email a job-seeker can send to one specific contact at a company. Use ONLY the ' +
        'candidate background and company notes given below — never invent a skill, achievement, employer, ' +
        'project, or fact about the candidate or the company. No filler phrases ("results-driven", "proven ' +
        'track record"), no first-person pronoun in the subject line. Greet the contact by their first name ' +
        'only. Structure the body as: an opening line stating the goal, then a short paragraph on why this ' +
        'company specifically — grounded in <company_notes> when it is given, otherwise keep this paragraph ' +
        'brief and general — then a short bulleted list of 3-4 concrete, named highlights drawn only from the ' +
        'candidate background (real project names and real skills, never invented ones), then one closing line ' +
        'inviting a reply or a quick call. End with a sign-off line ("Best," or "Kind regards,") followed by ' +
        "the candidate's real name, phone, and LinkedIn from the candidate background when those are given — " +
        'if no resume is linked, end with just the bare sign-off line and no name, since there is no real ' +
        'contact info to put there.',
    },
    {
      role: 'user',
      content:
        `<goal>\n${goalInstruction}\n</goal>\n\n` +
        (goal === 'referral' ? `<referral_role>\n${referralRole || '(not given)'}\n</referral_role>\n\n` : '') +
        `<contact>\nName: ${contact.name}\nRole: ${contact.role || '(not given)'}\n</contact>\n\n` +
        `<tone>\n${toneGuidance}\n</tone>\n\n` +
        `<company_name>\n${companyName}\n</company_name>\n\n` +
        (notes ? `<company_notes>\n${notes}\n</company_notes>\n\n` : '') +
        `<candidate_background>\n${buildResumeContext(resume)}\n</candidate_background>`,
    },
  ];
}
