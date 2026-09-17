export function EducationCard({ education }) {
  return (
    <div className="mb-4 md:mb-6 rounded-lg border border-border bg-card p-4 md:p-5 shadow-card">
      <h3 className="mb-3 font-display text-lg font-semibold text-foreground">Education</h3>
      <ul className="flex flex-col gap-3">
        {education.map((entry, index) => (
          <li key={index}>
            <p className="text-sm font-medium text-foreground">{entry.degree}</p>
            <p className="font-mono text-[11px] tracking-wide text-ink-faint uppercase">
              {[entry.institution, entry.location, entry.dateRange].filter(Boolean).join(" · ")}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
