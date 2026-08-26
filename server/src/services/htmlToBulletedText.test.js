import { test } from 'node:test';
import assert from 'node:assert/strict';
import { htmlToBulletedText } from './htmlToBulletedText.js';

test('prefixes list items with a bullet marker and leaves paragraphs/headings as-is', () => {
  const html =
    '<p>John Doe</p><p>WORK EXPERIENCE</p><p>Fullstack Engineer | Company A | Jan 2023 - Present</p>' +
    '<ul><li>Built scalable systems using Node.js and MongoDB. </li><li>Led a team of 4 engineers.</li></ul>';

  const text = htmlToBulletedText(html);

  assert.equal(
    text,
    [
      'John Doe',
      'WORK EXPERIENCE',
      'Fullstack Engineer | Company A | Jan 2023 - Present',
      '• Built scalable systems using Node.js and MongoDB.',
      '• Led a team of 4 engineers.',
    ].join('\n')
  );
});

test('decodes entities, flattens inline tags, and drops empty blocks', () => {
  const html = '<h1>Title</h1><p></p><li>Cut costs by 20% &amp; improved <strong>uptime</strong>.</li>';

  const text = htmlToBulletedText(html);

  assert.equal(text, 'Title\n• Cut costs by 20% & improved uptime.');
});

test('feeds cleanly into segmentResume to attach role/company/dateRange to list items', async () => {
  const { segmentResume } = await import('./segmentResume.js');
  const html =
    '<p>Backend Developer | Company B | Jun 2020 - Dec 2022</p>' +
    '<ul><li>Designed REST APIs for an e-commerce platform.</li></ul>';

  const bullets = segmentResume(htmlToBulletedText(html));

  assert.equal(bullets.length, 1);
  assert.deepEqual(bullets[0], {
    text: 'Designed REST APIs for an e-commerce platform.',
    role: 'Backend Developer',
    company: 'Company B',
    dateRange: 'Jun 2020 - Dec 2022',
  });
});
