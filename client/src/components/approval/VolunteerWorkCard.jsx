export function VolunteerWorkCard({ volunteerWork }) {
  return (
    <div className="mb-4 md:mb-6 rounded-lg border border-border bg-card p-4 md:p-5 shadow-card">
      <h3 className="mb-3 font-display text-lg font-semibold text-foreground">Volunteer Work</h3>
      <ul className="flex flex-col gap-3">
        {volunteerWork.map((entry, index) => (
          <li key={index}>
            <p className="text-sm font-medium text-foreground">{entry.role}</p>
            <p className="font-mono text-[11px] tracking-wide text-ink-faint uppercase">
              {[entry.organization, entry.dateRange].filter(Boolean).join(" · ")}
            </p>
            {entry.description && <p className="mt-1 text-sm text-muted-foreground">{entry.description}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
