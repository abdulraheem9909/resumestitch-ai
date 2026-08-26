import "./PlaceholderPage.css";

export default function PlaceholderPage({ eyebrow, title, description }) {
  return (
    <section className="placeholder-page">
      <p className="placeholder-eyebrow">{eyebrow}</p>
      <h1 className="placeholder-title">{title}</h1>
      <p className="placeholder-lede">{description}</p>
    </section>
  );
}
