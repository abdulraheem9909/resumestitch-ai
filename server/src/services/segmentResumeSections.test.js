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
    'CERTIFICATIONS',
    'AWS Certified Solutions Architect',
    'SKILLS',
    'AWS, Docker',
  ].join('\n');

  const result = segmentResumeSections(rawText);

  assert.equal(result.summary, 'A short summary.');
  assert.deepEqual(result.skills, ['AWS', 'Docker']);
  assert.ok(!result.summary.includes('AWS Certified'));
  assert.ok(!result.skills.includes('AWS Certified Solutions Architect'));
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
