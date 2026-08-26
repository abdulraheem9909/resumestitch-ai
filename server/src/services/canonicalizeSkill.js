import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const skillAliases = JSON.parse(readFileSync(path.join(__dirname, '../../data/skillAliases.json'), 'utf-8'));

export function canonicalizeSkill(rawSkill) {
  const normalized = (rawSkill || '').trim().toLowerCase();
  return skillAliases[normalized] || normalized;
}
