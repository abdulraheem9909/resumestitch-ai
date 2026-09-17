export function CertificationsCard({ certifications }) {
  return (
    <div className="mb-4 md:mb-6 rounded-lg border border-border bg-card p-4 md:p-5 shadow-card">
      <h3 className="mb-3 font-display text-lg font-semibold text-foreground">Certifications</h3>
      <ul className="flex flex-col gap-3">
        {certifications.map((entry, index) => (
          <li key={index}>
            <p className="text-sm font-medium text-foreground">{entry.name}</p>
            <p className="font-mono text-[11px] tracking-wide text-ink-faint uppercase">
              {[entry.issuer, entry.date].filter(Boolean).join(" · ")}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
