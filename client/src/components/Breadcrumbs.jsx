import { ChevronLeft } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * trail: [{ label, to? }] — the last entry (or any entry without `to`) is
 * rendered as plain text, the current page. backTo is optional; when given,
 * a chevron-only back button precedes the trail — same icon-button
 * convention as the edit/delete actions in MasterResumes.jsx.
 */
export default function Breadcrumbs({ trail, backTo }) {
  return (
    <div className="mb-6 flex items-center gap-3">
      {backTo && (
        <Link
          to={backTo}
          aria-label="Back"
          className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:border-primary hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <ChevronLeft className="size-4" />
        </Link>
      )}
      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap items-center gap-1.5 font-mono text-xs font-medium tracking-wide text-muted-foreground uppercase"
      >
        {trail.map((item, index) => {
          const isLast = index === trail.length - 1;
          return (
            <span key={index} className="flex items-center gap-1.5">
              {index > 0 && <span aria-hidden="true">/</span>}
              {item.to && !isLast ? (
                <Link to={item.to} className="transition-colors hover:text-foreground">
                  {item.label}
                </Link>
              ) : (
                <span className={isLast ? "text-foreground" : undefined}>{item.label}</span>
              )}
            </span>
          );
        })}
      </nav>
    </div>
  );
}
