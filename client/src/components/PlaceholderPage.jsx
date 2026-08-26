export default function PlaceholderPage({ eyebrow, title, description }) {
  return (
    <section className="max-w-2xl">
      <p className="mb-2.5 font-mono text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {eyebrow}
      </p>
      <h1 className="font-display mb-3 text-3xl font-semibold text-foreground">{title}</h1>
      <p className="text-base text-muted-foreground">{description}</p>
    </section>
  );
}
