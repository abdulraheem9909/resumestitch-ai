// Matched = every JD canonical skill (node 3's jdCanonicalSkills) that isn't
// in the current keyword-gap list — both fields already live on the
// application document, so this is purely a display computation over data
// node 3/gap analysis already produced. Doesn't read or affect
// jdCanonicalSkills/keywordGaps themselves, and isn't wired into scoring or
// the retry conditional. Content-only (no card wrapper) — rendered inside
// SkillFrequencyCard, above its own collapsible detail table.
export function SkillMatchBar({ jdCanonicalSkills, keywordGaps }) {
  const total = jdCanonicalSkills.length;
  const gapSet = new Set(keywordGaps || []);
  const matched = jdCanonicalSkills.filter((skill) => !gapSet.has(skill)).length;
  const percent = total === 0 ? 0 : Math.round((matched / total) * 100);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-4">
        <p className="font-mono text-[11px] tracking-wide text-ink-faint uppercase">
          Skills matched
        </p>
        <p className="text-sm font-medium text-foreground">
          {matched} / {total} skills matched
        </p>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
