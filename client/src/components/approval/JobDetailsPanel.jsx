export function JobDetailsPanel({ application }) {
  // referenceUrl is free-text the user typed in at application-creation time
  // (see key-decisions-log.md — it's never fetched server-side, display only)
  // — only render it as a clickable link when it's genuinely http(s), so a
  // stray javascript:/data: scheme can never execute on click.
  const safeReferenceUrl = /^https?:\/\//i.test(application?.referenceUrl || "") ? application.referenceUrl : null;

  return (
    <div className="mb-4 md:mb-6 rounded-lg border border-border bg-card p-4 md:p-5 shadow-card">
      <p className="mb-3 font-mono text-[11px] tracking-wide text-ink-faint uppercase">Job Details</p>
      <h2 className="font-display text-lg font-semibold text-foreground">{application.companyName}</h2>
      <p className="mb-4 text-sm text-muted-foreground">{application.jobTitle}</p>
      <p className="mb-1 text-xs font-medium text-muted-foreground">Reference link</p>
      {safeReferenceUrl ? (
        <a
          href={safeReferenceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-4 block text-sm text-primary underline underline-offset-2 break-all"
        >
          {safeReferenceUrl}
        </a>
      ) : application.referenceUrl ? (
        <p className="mb-4 text-sm break-all text-foreground">{application.referenceUrl}</p>
      ) : (
        <p className="mb-4 text-sm text-muted-foreground">No reference link saved.</p>
      )}
      <p className="mb-1 text-xs font-medium text-muted-foreground">Job description</p>
      <p className="whitespace-pre-wrap text-sm text-foreground">{application.jdSnapshot}</p>
    </div>
  );
}
