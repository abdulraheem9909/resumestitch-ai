import { test } from 'node:test';
import assert from 'node:assert/strict';
import { segmentResumeSections } from './segmentResumeSections.js';

const REAL_RESUME_FIXTURE = [
  'SUMMARY',
  'Software developer with 5+ years of experience in delivering impactful solutions and rapidly adapting to new technologies.',
  'Passionate about building innovative, high-performance applications that drive efficiency and enhance user experience.',
  'WORK EXPERIENCE',
  'Fullstack & AI Engineer • Freelancer09/2024 - Present',
  'Self-Employed • Remote',
  '● Developed frontend solutions for clients using React and Node.js alongside postgraduate studies',
  'EDUCATION',
  "Master's in Software Engineering09/2024 - 01/2026",
  'University of Salford • Manchester, UK',
  "Bachelor's in Computer Science10/2015 - 05/2020",
  'University of Central Punjab • Pakistan',
  'PROJECTS',
  'CEPRA Tool',
  'Developed an executive-level planning and resource allocation tool for C-level leaders, enabling the management of 10+ projects simultaneously. Improved milestone tracking by 30%, optimized resource utilization, and enhanced budget control for seamless project execution.',
  'SolicitorSense AI - Legal Document Assistant',
  'An intelligent legal document assistant that democratizes access to UK employment law through RAG (Retrieval-Augmented Generation) technology, helping individuals and small businesses understand complex legal information.',
  'SKILLS',
  'TypeScript, JavaScript, React, Node.js, Mentorship, Git, Retrieval-Augmented Generation (RAG), Code Review',
].join('\n');

test('extracts summary, education, projects, and skills from a real resume structure', () => {
  const result = segmentResumeSections(REAL_RESUME_FIXTURE);

  assert.equal(
    result.summary,
    'Software developer with 5+ years of experience in delivering impactful solutions and rapidly adapting to new technologies. Passionate about building innovative, high-performance applications that drive efficiency and enhance user experience.'
  );

  assert.equal(result.education.length, 2);
  assert.deepEqual(result.education[0], {
    degree: "Master's in Software Engineering",
    dateRange: '09/2024 - 01/2026',
    institution: 'University of Salford',
    location: 'Manchester, UK',
  });
  assert.deepEqual(result.education[1], {
    degree: "Bachelor's in Computer Science",
    dateRange: '10/2015 - 05/2020',
    institution: 'University of Central Punjab',
    location: 'Pakistan',
  });

  assert.equal(result.projects.length, 2);
  assert.equal(result.projects[0].name, 'CEPRA Tool');
  assert.ok(result.projects[0].description.startsWith('Developed an executive-level planning'));
  assert.equal(result.projects[1].name, 'SolicitorSense AI - Legal Document Assistant');

  assert.deepEqual(result.skills, [
    'TypeScript',
    'JavaScript',
    'React',
    'Node.js',
    'Mentorship',
    'Git',
    'Retrieval-Augmented Generation (RAG)',
    'Code Review',
  ]);
});

test('returns empty arrays/strings when a section is missing entirely', () => {
  const rawText = [
    'SUMMARY',
    'A short summary line.',
    'SKILLS',
    'React, Node.js',
  ].join('\n');

  const result = segmentResumeSections(rawText);

  assert.equal(result.summary, 'A short summary line.');
  assert.deepEqual(result.education, []);
  assert.deepEqual(result.projects, []);
  assert.deepEqual(result.skills, ['React', 'Node.js']);
});

test('recognizes common heading wording variants', () => {
  const rawText = [
    'PROFILE',
    'An experienced engineer.',
    'TECHNICAL SKILLS',
    'Python, Go',
  ].join('\n');

  const result = segmentResumeSections(rawText);

  assert.equal(result.summary, 'An experienced engineer.');
  assert.deepEqual(result.skills, ['Python', 'Go']);
});

test('falls back to the preamble paragraph as the summary when there is no SUMMARY-style heading at all', () => {
  const rawText = [
    'Abdul Raheem',
    'Manchester, UK, England • +447700900123 • abdul.raheem@example.com •',
    'linkedin.com/in/abdulraheem-dev • https://abdul-portfolio.vercel.app',
    'Software Engineer',
    'Software developer with 5+ years of experience in delivering impactful solutions and rapidly adapting to new',
    'technologies. Passionate about building innovative, high-performance applications that drive efficiency and',
    'enhance user experience.',
    'WORK EXPERIENCE',
    'Fullstack Engineer • Freelancer 09/2024 - Present',
    '● Built things.',
    'SKILLS',
    'React, Node.js',
  ].join('\n');

  const result = segmentResumeSections(rawText);

  assert.equal(
    result.summary,
    'Software developer with 5+ years of experience in delivering impactful solutions and rapidly adapting to new technologies. Passionate about building innovative, high-performance applications that drive efficiency and enhance user experience.'
  );
  assert.deepEqual(result.skills, ['React', 'Node.js']);
});

test('handles an education entry where the degree name has its own line and the date shares the institution/location line instead', () => {
  const rawText = [
    'SUMMARY',
    'A short summary.',
    'EDUCATION',
    'Masters in Software Engineering',
    'University of Salford • Manchester,UK 09/2024 - 01/2026',
    'Bachelors  in Computer Science',
    'University of Central Punjab • Pakistan 10/2015 - 05/2020',
    'SKILLS',
    'React',
  ].join('\n');

  const result = segmentResumeSections(rawText);

  assert.equal(result.education.length, 2);
  assert.deepEqual(result.education[0], {
    degree: 'Masters in Software Engineering',
    dateRange: '09/2024 - 01/2026',
    institution: 'University of Salford',
    location: 'Manchester,UK',
  });
  assert.deepEqual(result.education[1], {
    degree: 'Bachelors in Computer Science',
    dateRange: '10/2015 - 05/2020',
    institution: 'University of Central Punjab',
    location: 'Pakistan',
  });
});

test('drops content under an unrecognized heading rather than mis-bucketing it', () => {
  const rawText = [
    'SUMMARY',
    'A short summary.',
    'AWARDS',
    'Employee of the Year',
    'SKILLS',
    'AWS, Docker',
  ].join('\n');

  const result = segmentResumeSections(rawText);

  assert.equal(result.summary, 'A short summary.');
  assert.deepEqual(result.skills, ['AWS', 'Docker']);
  assert.ok(!result.summary.includes('Employee of the Year'));
  assert.ok(!result.skills.includes('Employee of the Year'));
});

test('extracts a certification with issuer and date split from a single line', () => {
  const rawText = [
    'SUMMARY',
    'A short summary.',
    'CERTIFICATIONS',
    'AWS Certified Solutions Architect — Amazon Web Services, 2023',
    'SKILLS',
    'AWS',
  ].join('\n');

  const result = segmentResumeSections(rawText);

  assert.equal(result.certifications.length, 1);
  assert.deepEqual(result.certifications[0], {
    name: 'AWS Certified Solutions Architect',
    issuer: 'Amazon Web Services',
    date: '2023',
  });
});

test('falls back to the whole line as the certification name when it has no clean issuer split', () => {
  const rawText = [
    'SUMMARY',
    'A short summary.',
    'CERTIFICATIONS',
    'Certified Kubernetes Administrator 2022',
    'SKILLS',
    'Kubernetes',
  ].join('\n');

  const result = segmentResumeSections(rawText);

  assert.equal(result.certifications.length, 1);
  assert.deepEqual(result.certifications[0], {
    name: 'Certified Kubernetes Administrator',
    issuer: '',
    date: '2022',
  });
});

// Real-world repro: a real resume's certifications aren't reliably one line
// each — a title/issuer/date block just as often spans three separate lines.
// The original single-line-only parser split each of these into three
// garbled entries instead of merging them into one.
test('merges a certification whose title, issuer, and date each sit on their own line into one entry', () => {
  const rawText = [
    'SUMMARY',
    'A short summary.',
    'CERTIFICATIONS',
    'Build Apps with Flutter',
    'Google',
    'Oct 2024',
    'Swift Programming Language Course',
    'Udemy',
    'Jun 2024',
    'SKILLS',
    'Flutter',
  ].join('\n');

  const result = segmentResumeSections(rawText);

  assert.equal(result.certifications.length, 2);
  assert.deepEqual(result.certifications[0], { name: 'Build Apps with Flutter', issuer: 'Google', date: 'Oct 2024' });
  assert.deepEqual(result.certifications[1], {
    name: 'Swift Programming Language Course',
    issuer: 'Udemy',
    date: 'Jun 2024',
  });
});

test('merges a certification with a title line and a date line but no separate issuer line', () => {
  const rawText = [
    'SUMMARY',
    'A short summary.',
    'CERTIFICATIONS',
    'Certified Scrum Master',
    '2021',
    'SKILLS',
    'Agile',
  ].join('\n');

  const result = segmentResumeSections(rawText);

  assert.equal(result.certifications.length, 1);
  assert.deepEqual(result.certifications[0], { name: 'Certified Scrum Master', issuer: '', date: '2021' });
});

test('extracts volunteer work entries across role/organization/dateRange header lines and a following description', () => {
  const rawText = [
    'SUMMARY',
    'A short summary.',
    'VOLUNTEER WORK',
    'Youth Coding Mentor — Code Club 06/2020 - 08/2022',
    'Ran weekly programming workshops for teenagers in the local community.',
    'Food Bank Volunteer — Trussell Trust 01/2019 - 05/2020',
    'SKILLS',
    'React',
  ].join('\n');

  const result = segmentResumeSections(rawText);

  assert.equal(result.volunteerWork.length, 2);
  assert.deepEqual(result.volunteerWork[0], {
    role: 'Youth Coding Mentor',
    organization: 'Code Club',
    dateRange: '06/2020 - 08/2022',
    description: 'Ran weekly programming workshops for teenagers in the local community.',
  });
  assert.deepEqual(result.volunteerWork[1], {
    role: 'Food Bank Volunteer',
    organization: 'Trussell Trust',
    dateRange: '01/2019 - 05/2020',
    description: '',
  });
});

// Real-world repro: a volunteer entry's role, organization, and date range
// each sitting on their own line (rather than role+organization sharing the
// date's line) used to shred one entry into two garbled ones — a bare role
// line with no date ever attached, and a bare-organization-as-description
// entry with the date but no role.
test('merges a volunteer entry whose role, organization, and date range each sit on their own line', () => {
  const rawText = [
    'SUMMARY',
    'A short summary.',
    'VOLUNTEER WORK',
    'Youth Coding Mentor',
    'Code Club',
    '06/2020 - 08/2022',
    'EDUCATION',
    "Bachelor's degree",
    'Some University - 2020',
  ].join('\n');

  const result = segmentResumeSections(rawText);

  assert.equal(result.volunteerWork.length, 1);
  assert.deepEqual(result.volunteerWork[0], {
    role: 'Youth Coding Mentor',
    organization: 'Code Club',
    dateRange: '06/2020 - 08/2022',
    description: '',
  });
});

test('keeps a description wrapped across two lines as one entry, not a new one', () => {
  const rawText = [
    'SUMMARY',
    'A short summary.',
    'VOLUNTEER WORK',
    'Mentor',
    'Code Club',
    '2020 - 2021',
    'Helped organize weekly',
    'sessions for beginners.',
    'SKILLS',
    'React',
  ].join('\n');

  const result = segmentResumeSections(rawText);

  assert.equal(result.volunteerWork.length, 1);
  assert.equal(result.volunteerWork[0].description, 'Helped organize weekly sessions for beginners.');
});

test('splits two consecutive multi-line volunteer entries once the first has a complete, punctuated description', () => {
  const rawText = [
    'SUMMARY',
    'A short summary.',
    'VOLUNTEER WORK',
    'Youth Coding Mentor',
    'Code Club',
    '06/2020 - 08/2022',
    'Ran weekly programming workshops for teenagers.',
    'Food Bank Volunteer',
    'Trussell Trust',
    '01/2019 - 05/2020',
    'SKILLS',
    'React',
  ].join('\n');

  const result = segmentResumeSections(rawText);

  assert.equal(result.volunteerWork.length, 2);
  assert.deepEqual(result.volunteerWork[0], {
    role: 'Youth Coding Mentor',
    organization: 'Code Club',
    dateRange: '06/2020 - 08/2022',
    description: 'Ran weekly programming workshops for teenagers.',
  });
  assert.deepEqual(result.volunteerWork[1], {
    role: 'Food Bank Volunteer',
    organization: 'Trussell Trust',
    dateRange: '01/2019 - 05/2020',
    description: '',
  });
});

test('recognizes CERTIFICATIONS and VOLUNTEER WORK heading variants written in Title Case', () => {
  const rawText = [
    'Summary',
    'A short summary.',
    'Certifications',
    'Certified Scrum Master 2021',
    'Volunteering',
    'Community Helper — Local Shelter 2020 - 2021',
    'Skills',
    'React',
  ].join('\n');

  const result = segmentResumeSections(rawText);

  assert.equal(result.certifications.length, 1);
  assert.equal(result.certifications[0].name, 'Certified Scrum Master');
  assert.equal(result.volunteerWork.length, 1);
  assert.equal(result.volunteerWork[0].role, 'Community Helper');
});

// Real-world repro: a resume's headings ("Work Experience", "Core Skills",
// "Education") were in Title Case rather than ALL CAPS. isSectionHeading()
// required shouting on top of the words matching, so none of them were ever
// recognized as headings at all — every section's content silently fell
// through to whatever the previous (mis-detected) section was.
test('recognizes a known heading written in Title Case, not only ALL CAPS', () => {
  const rawText = [
    'Summary',
    'A short summary.',
    'Core Skills',
    'Flutter, Dart',
    'Education',
    'Some University',
  ].join('\n');

  const result = segmentResumeSections(rawText);

  assert.equal(result.summary, 'A short summary.');
  assert.deepEqual(result.skills, ['Flutter', 'Dart']);
});

// Real-world repro: a bare "City, Postal, Country" address line with no
// heading, phone, email, or URL of its own sat directly above the real
// summary paragraph and got swallowed into it as the implied-summary
// fallback's leading sentence.
test('excludes a bare location line from the implied summary when there is no explicit heading', () => {
  const rawText = [
    'Abdul Rehman',
    'maan852@live.com',
    'Dubai, 00000, United Arab Emirates',
    'Experienced developer with 6+ years building mobile and web applications.',
  ].join('\n');

  const result = segmentResumeSections(rawText);

  assert.equal(result.summary, 'Experienced developer with 6+ years building mobile and web applications.');
});

// Real-world repro: a resume's sidebar layout extracted "Core Skills" /
// "Education" / "Certificates" back-to-back with none of their actual
// content between them, so every line after "Certificates" — the real
// skills list, both real education entries, and the real certificates —
// all got attributed to certifications. ambiguousSections is what lets
// resumes.js recognize that education/skills/certifications are all suspect
// here, not just silently trust whichever one happened to end up holding
// the content.
test('flags every heading in a back-to-back run as ambiguous when their content is stacked afterward', () => {
  const rawText = [
    'SUMMARY',
    'A short summary.',
    'CORE SKILLS',
    'EDUCATION',
    'CERTIFICATES',
    'Flutter, Swift.',
    'University Of Central Punjab',
    "Bachelor's degree Computer Science 2015 - 2020",
    'Build Apps with Flutter',
    'Google',
    'Oct 2024',
  ].join('\n');

  const result = segmentResumeSections(rawText);

  assert.deepEqual(new Set(result.ambiguousSections), new Set(['skills', 'education', 'certifications']));
});

test('does not flag an isolated heading immediately followed by its own content', () => {
  const rawText = [
    'SUMMARY',
    'A short summary.',
    'EDUCATION',
    "Bachelor's degree",
    'Some University - 2020',
    'SKILLS',
    'React, Node.js',
  ].join('\n');

  const result = segmentResumeSections(rawText);

  assert.deepEqual(result.ambiguousSections, []);
});
