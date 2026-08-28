/**
 * Token-set Jaccard distance between source and tailored bullet text —
 * 0 means the same wording, 1 means no shared words. Order-insensitive on
 * purpose, since STAR rephrasing is expected to reorder clauses; an
 * order-sensitive metric (e.g. edit distance) would flag legitimate
 * rewrites as "high intensity" purely for moving words around. Diagnostic
 * signal only — not a fabrication check (that's deterministicVerification.js).
 */
export function rephraseIntensity(sourceText, generatedText) {
  const tokenize = (s) =>
    new Set(
      (s || '')
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(Boolean)
    );

  const a = tokenize(sourceText);
  const b = tokenize(generatedText);
  const intersection = [...a].filter((token) => b.has(token)).length;
  const union = new Set([...a, ...b]).size;
  const jaccard = union === 0 ? 0 : intersection / union;

  return Math.round((1 - jaccard) * 100) / 100;
}
