export function CandidateInfoCard({ masterResume }) {
  const personalInfo = masterResume?.personalInfo || {};
  const contactLine = [personalInfo.location, personalInfo.phone, personalInfo.email, personalInfo.linkedin, personalInfo.portfolio]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mb-6 rounded-lg border border-border bg-card p-5 shadow-card">
      <p className="mb-3 font-mono text-[11px] tracking-wide text-ink-faint uppercase">
        Your resume — read-only here, edit it on your Master Resume page
      </p>
      <h2 className="font-display text-xl font-semibold text-foreground">
        {masterResume.personalInfo?.fullName}
      </h2>
      {contactLine && <p className="mt-1 text-sm text-muted-foreground">{contactLine}</p>}
    </div>
  );
}
