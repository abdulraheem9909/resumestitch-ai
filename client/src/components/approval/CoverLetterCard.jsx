export function CoverLetterCard({ coverLetterText }) {
  return (
    <div className="mb-4 md:mb-6 rounded-lg border border-border bg-card p-4 md:p-5 shadow-card">
      <p className="mb-3 font-mono text-[11px] tracking-wide text-ink-faint uppercase">Cover letter</p>
      <p className="whitespace-pre-wrap text-sm text-foreground">
        {coverLetterText || "—"}
      </p>
    </div>
  );
}
