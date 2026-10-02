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
