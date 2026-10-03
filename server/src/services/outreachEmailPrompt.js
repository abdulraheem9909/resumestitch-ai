// Tone instructions keyed by the contact's category — one flexible prompt
// with conditional instructions per goal×category, not six hardcoded
// templates, same "instructions over branching" style as tailorContent.js.
const CATEGORY_TONE_GUIDANCE = {
  Leadership:
    'Address them as a founder or senior executive. Keep the tone confident and peer-to-peer, oriented around ' +
    'vision and impact — why this company specifically.',
  'Talent & HR':
    'Address them as a recruiter or talent professional. Keep it a tight, qualifications-forward pitch oriented ' +
    'around role fit and next steps — still short, never a resume recap.',
  Employee:
    'Address them as a peer individual contributor. Keep the tone casual and curious, peer-to-peer, not a formal pitch.',
  Other:
    "Keep the tone neutral and professional, similar to writing to a recruiter, since this contact's exact role isn't known.",
};

const GOAL_INSTRUCTIONS = {
  speculative:
    'The candidate wants to know whether this company has an open role for them right now, or if not, to be ' +
    'kept in mind for a future opening. State this directly as the ask — never a vague phrase like "learn more" ' +
    'or "set up a time to chat." Write one message that naturally covers both the "now" and "future" cases, ' +
    'never as two separate asks.',
  referral:
    'The candidate has already applied to a specific role elsewhere at this company and is directly asking this ' +
    'contact to flag or refer that application internally. The exact role is given below as <referral_role> — ' +
    'reference it by name.',
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
        'Write a short, direct cold outreach email a job-seeker can send to one specific contact at a company ' +
        '— this is a cold email, not a cover letter. Research on cold outreach consistently shows shorter ' +
        'performs better (a Hubspot analysis of 40 million emails found 50-125 words maximized reply rates): ' +
        'target roughly 80-130 words in the body, excluding the sign-off, in at most 2 short paragraphs, no ' +
        'bulleted list. Use ONLY the candidate background and company notes given below — never invent a ' +
        'skill, achievement, employer, project, or fact about the candidate or the company. Skip empty opening ' +
        'pleasantries like "I hope this email finds you well" — go straight into who the candidate is and why ' +
        "they're reaching out. No filler phrases (\"results-driven\", \"proven track record\"), no first-person " +
        'pronoun in the subject line. Greet the contact by their first name only, on its own line (e.g. "Hi ' +
        'Lewis," or "Lewis,"), then a blank line, then the body text starting fresh — never run the greeting ' +
        'into the same sentence as the rest of the message. Mention one or two concrete, specific ' +
        'accomplishments woven naturally into a sentence — never a bulleted list or a resume recap; one ' +
        'compelling detail beats full coverage, since the attached CV carries the rest. When citing a ' +
        'project, use its exact given name verbatim (e.g. "Project Nova") — never a generic paraphrase ' +
        'of what it does instead of naming it, and never label it with a casual meta-phrase like "this is my ' +
        'recent work" or "I completed a project on X" — weave the name into a sentence about relevant ' +
        'experience the way a professional bio would, not as its own announcement. If a project\'s given name ' +
        'includes a descriptive suffix after a dash (e.g. "Project Nova - University Capstone Project"), you ' +
        'may cite just the core name before the dash — that suffix is a category label, not part of the real ' +
        'name. Keep the framing internally consistent throughout: if the opening establishes professional ' +
        'seniority (years of experience, a job title), do not immediately undercut it by labeling the next ' +
        'accomplishment as academic ("a dissertation," "my MSc project") even if the candidate background ' +
        'itself uses that language — describe what was built or its outcome instead, in terms consistent with ' +
        'the professional framing already established. If company notes ' +
        'are given, weave in one genuine specific from them rather than giving "why this company" its own ' +
        'paragraph. State the ask directly and specifically — never a vague phrase. End with one brief, ' +
        'confident closing line, then a sign-off ("Best," or "Kind regards,") followed by the candidate\'s ' +
        'real name, phone, and LinkedIn from the candidate background when those are given — if no resume is ' +
        'linked, output the sign-off word by itself with absolutely nothing after it: no name, no placeholder, ' +
        'no bracketed text like "[Your Name]", since there is no real contact info to put there.',
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
