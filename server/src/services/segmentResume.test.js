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
