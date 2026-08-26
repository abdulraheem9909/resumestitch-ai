import { parse } from 'node-html-parser';

const BLOCK_SELECTOR = 'p, li, h1, h2, h3, h4, h5, h6';

/**
 * Converts mammoth's convertToHtml() output into plain text with a literal
 * bullet marker restored on each list item, so it can be fed into
 * segmentResume() the same way pdf-parse's plain text is. mammoth's
 * extractRawText() strips Word's list formatting entirely, so <li> is the
 * only reliable signal that a paragraph was a bullet, not a header line.
 */
export function htmlToBulletedText(html) {
  const root = parse(html || '');
  const lines = [];

  for (const element of root.querySelectorAll(BLOCK_SELECTOR)) {
    const text = element.text.trim();
    if (!text) continue;
    lines.push(element.tagName === 'LI' ? `• ${text}` : text);
  }

  return lines.join('\n');
}
