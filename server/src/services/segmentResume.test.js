import { test } from 'node:test';
import assert from 'node:assert/strict';
import { segmentResume } from './segmentResume.js';

test('segments a job block with role, company, and date range on separate lines', () => {
  const rawText = [
    'Software Engineer',
    'Company A',
    'Jan 2023 – Present',
    '• Built scalable systems using Node.js and MongoDB.',
    '• Led a team of 4 engineers on a microservices migration.',
  ].join('\n');

  const bullets = segmentResume(rawText);

  assert.equal(bullets.length, 2);
  assert.deepEqual(bullets[0], {
    text: 'Built scalable systems using Node.js and MongoDB.',
    role: 'Software Engineer',
    company: 'Company A',
    dateRange: 'Jan 2023 – Present',
  });
  assert.equal(bullets[1].text, 'Led a team of 4 engineers on a microservices migration.');
});

test('handles multiple job sections and different bullet characters', () => {
  const rawText = [
    'Backend Developer',
    'Company B',
    'Jun 2020 - Dec 2022',
    '- Designed REST APIs for an e-commerce platform.',
    '* Improved test coverage from 40% to 85%.',
    'Frontend Developer',
    'Company C',
    'Mar 2018 to May 2020',
    '• Rebuilt the checkout flow in React.',
  ].join('\n');

  const bullets = segmentResume(rawText);

  assert.equal(bullets.length, 3);
  assert.equal(bullets[0].company, 'Company B');
  assert.equal(bullets[0].dateRange, 'Jun 2020 - Dec 2022');
  assert.equal(bullets[1].role, 'Backend Developer');
  assert.equal(bullets[2].company, 'Company C');
  assert.equal(bullets[2].dateRange, 'Mar 2018 to May 2020');
  assert.equal(bullets[2].text, 'Rebuilt the checkout flow in React.');
});

test('splits a combined role/company header line sharing the date-range line', () => {
  const rawText = [
    'Company D',
    'Full-Stack Engineer | Aug 2021 – Present',
    '• Shipped a payments dashboard used by 200+ merchants.',
  ].join('\n');

  const bullets = segmentResume(rawText);

  assert.equal(bullets.length, 1);
  assert.equal(bullets[0].role, 'Full-Stack Engineer');
  assert.equal(bullets[0].company, 'Company D');
  assert.equal(bullets[0].dateRange, 'Aug 2021 – Present');
});

test('handles PDF-style extraction quirks: numeric dates, role+date/company-on-next-line, ● bullets, wrapped continuations, and page-break markers', () => {
  const rawText = [
    '• contact-line-that-starts-with-a-bullet-glyph@example.com',
    'WORK EXPERIENCE',
    'Fullstack Engineer • Freelancer09/2024 - Present',
    'Self-Employed • Remote',
    '● Architected a system deployed on AWS EC2 with role-based access',
    'control and JWT authentication',
    'Software Engineer 05/2024 - 08/2024',
    'Fiverivers Technologies',
    '● Mentored engineers, fostering a culture of cross-functional',
    'collaboration',
    'Software Engineer 09/2023 - 05/2024',
    'Ropstam Solutions',
    '● Shipped a feature',
    '',
    '-- 1 of 2 --',
    '',
    '● Worked jointly across teams to deliver high-quality software',
    'solutions',
  ].join('\n');

  const bullets = segmentResume(rawText);

  assert.equal(bullets.length, 4);
  // The bullet-glyph contact line before any job section is established must be dropped.
  assert.ok(!bullets.some((b) => b.text.includes('contact-line')));

  assert.deepEqual(bullets[0], {
    text: 'Architected a system deployed on AWS EC2 with role-based access control and JWT authentication',
    role: 'Fullstack Engineer',
    company: 'Freelancer',
    dateRange: '09/2024 - Present',
  });

  assert.equal(bullets[1].role, 'Software Engineer');
  assert.equal(bullets[1].company, 'Fiverivers Technologies');
  assert.equal(bullets[1].text, 'Mentored engineers, fostering a culture of cross-functional collaboration');

  assert.equal(bullets[2].company, 'Ropstam Solutions');

  // Page-break markers must be dropped, not glued onto surrounding bullet text.
  assert.equal(bullets[2].text, 'Shipped a feature');
  assert.equal(bullets[3].company, 'Ropstam Solutions');
  assert.equal(bullets[3].text, 'Worked jointly across teams to deliver high-quality software solutions');
});

test('ignores unrelated leading lines (name/summary) and returns an empty array when there are no bullets', () => {
  const withLeadingNoise = [
    'John Doe',
    'john@example.com | +1 555 0100',
    'Product-focused engineer with 6 years of experience.',
    'Software Engineer',
    'Company A',
    'Jan 2023 – Present',
    '• Built scalable systems using Node.js and MongoDB.',
  ].join('\n');

  const bullets = segmentResume(withLeadingNoise);
  assert.equal(bullets.length, 1);
  assert.equal(bullets[0].role, 'Software Engineer');
  assert.equal(bullets[0].company, 'Company A');

  assert.deepEqual(segmentResume('John Doe\nSoftware Engineer\n\nNo bullets or dates here.'), []);
});

test('does not mistake an EDUCATION entry\'s own date range for a new job header', () => {
  const withoutEducation = [
    'WORK EXPERIENCE',
    'Software Engineer',
    'Company A',
    'Jan 2023 – Present',
    '• Built scalable systems using Node.js and MongoDB.',
  ].join('\n');

  const withEducation = [
    'WORK EXPERIENCE',
    'Software Engineer',
    'Company A',
    'Jan 2023 – Present',
    '• Built scalable systems using Node.js and MongoDB.',
    'EDUCATION',
    "Master's in Software Engineering09/2024 - 01/2026",
    'University of Salford • Manchester, UK',
  ].join('\n');

  const bulletsWithout = segmentResume(withoutEducation);
  const bulletsWith = segmentResume(withEducation);

  // The EDUCATION block must not produce a phantom extra "job" or corrupt the real one.
  assert.deepEqual(bulletsWith, bulletsWithout);
});

test('joins a wrapped bullet whose continuation starts with a capitalized proper noun and precedes the next job header', () => {
  // Real-world repro: the continuation line ("OpenAI GPT-4, ...") starts
  // uppercase (so the lowercase-continuation heuristic can't catch it) and
  // the very next job's real header sits only two lines later — both signals
  // a naive lookahead would misread as "a new header is starting here".
  const rawText = [
    'Software Engineer',
    'Company X',
    'Jan 2023 – Present',
    '• Built a legal assistant using RAG technology (Next.js,',
    'OpenAI GPT-4, LangChain, Pinecone), deployed on AWS.',
    'Software Engineer',
    'Company Y',
    'Feb 2024 – Present',
    '• Improved UI responsiveness by 30%.',
  ].join('\n');

  const bullets = segmentResume(rawText);

  assert.equal(bullets.length, 2);
  assert.equal(
    bullets[0].text,
    'Built a legal assistant using RAG technology (Next.js, OpenAI GPT-4, LangChain, Pinecone), deployed on AWS.'
  );
  assert.equal(bullets[0].company, 'Company X');
  assert.equal(bullets[1].company, 'Company Y');
  assert.equal(bullets[1].text, 'Improved UI responsiveness by 30%.');
});

test('joins a hyphenated compound word split across the line wrap without inserting a stray space', () => {
  const rawText = [
    'Software Engineer',
    'Company A',
    'Jan 2023 – Present',
    '• Mentored 5 junior developers, fostering a culture of cross-',
    'functional collaboration.',
    '• Reduced bug reports by 50% post-',
    'launch.',
  ].join('\n');

  const bullets = segmentResume(rawText);

  assert.equal(bullets.length, 2);
  assert.equal(bullets[0].text, 'Mentored 5 junior developers, fostering a culture of cross-functional collaboration.');
  assert.equal(bullets[1].text, 'Reduced bug reports by 50% post-launch.');
});

test('a bullet ending mid-sentence with a trailing comma (no parenthesis) still joins its capitalized continuation', () => {
  const rawText = [
    'Software Engineer',
    'Company A',
    'Jan 2023 – Present',
    '• Built tools using React, Node.js,',
    'TypeScript, and GraphQL.',
  ].join('\n');

  const bullets = segmentResume(rawText);

  assert.equal(bullets.length, 1);
  assert.equal(bullets[0].text, 'Built tools using React, Node.js, TypeScript, and GraphQL.');
});

test('recognizes a date range whose connecting separator was lost to a multi-column PDF layout', () => {
  // Real-world repro: a two-column resume (job details left, date range
  // right) had its dash extracted onto a disconnected line elsewhere, leaving
  // the two dates sitting next to each other with only whitespace between them.
  const rawText = [
    'Senior Software Engineer (Flutter)',
    'Algo Republic | Lahore, Pakistan',
    'Oct 2023 Present',
    '• Developed 9 high-performance applications.',
  ].join('\n');

  const bullets = segmentResume(rawText);

  assert.equal(bullets.length, 1);
  assert.equal(bullets[0].dateRange, 'Oct 2023 Present');
});

test('does not treat two unrelated bare years in running text as a date range', () => {
  const rawText = [
    'Software Engineer',
    'Company A',
    'Jan 2023 – Present',
    '• Reduced latency comparing 2024 against 2023 benchmarks.',
  ].join('\n');

  const bullets = segmentResume(rawText);

  assert.equal(bullets.length, 1);
  assert.equal(bullets[0].text, 'Reduced latency comparing 2024 against 2023 benchmarks.');
});

// Real-world repro: "Company — Role" sits on its own line, then "Location —
// Date range" shares the next line. The date line's own leftover text
// ("Manchester, UK") splits cleanly on its comma, but into a location, not a
// role/company — the real header was already fully formed on the line above.
test('prefers a self-contained "Company — Role" header buffered above over splitting a location that shares the date line', () => {
  const rawText = [
    'Auxillium Services — Door Supervisor (Full-Time)',
    'Manchester, UK — 09/2024 – Present',
    '• Conduct access control and ID checks.',
  ].join('\n');

  const bullets = segmentResume(rawText);

  assert.equal(bullets.length, 1);
  assert.equal(bullets[0].role, 'Door Supervisor (Full-Time)');
  assert.equal(bullets[0].company, 'Auxillium Services');
});
