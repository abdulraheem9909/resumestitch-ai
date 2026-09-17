export function ProjectsCard({ projects }) {
  return (
    <div className="mb-4 md:mb-6 rounded-lg border border-border bg-card p-4 md:p-5 shadow-card">
      <h3 className="mb-3 font-display text-lg font-semibold text-foreground">Projects</h3>
      <ul className="flex flex-col gap-3">
        {projects.map((entry, index) => (
          <li key={index}>
            <p className="text-sm font-medium text-foreground">{entry.name}</p>
            <p className="text-sm text-muted-foreground">{entry.description}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
