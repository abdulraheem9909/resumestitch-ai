import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { APPLICATIONS_API as API_BASE } from "../../lib/api.js";
import { apiFetch } from "../../lib/apiFetch.js";
import { Spinner } from "../Spinner.jsx";

// Purely informational, non-blocking — the same spirit as Re-check: nothing
// here gates export or approval, and nothing is persisted to the
// application document. GET /:id/searchability-check rebuilds the resume
// export in memory fresh every time this runs, so it always reflects the
// current tailored text/skills, not a stale snapshot. Open by default (still
// collapsible — this codebase's existing toggle idiom, see the "Show
// original AI feedback" toggle) so it fetches once on mount; manually
// closing and reopening it re-fetches, same as always opening did before.
export function SearchabilityCheckCard({ applicationId }) {
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checks, setChecks] = useState(null);

  async function runCheck() {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(`${API_BASE}/${applicationId}/searchability-check`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't run the searchability check.");
      setChecks(data.checks);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) runCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) runCheck();
  }

  return (
    <div className="mb-6 rounded-lg border border-border bg-card p-5 shadow-card">
      <button type="button" className="flex w-full cursor-pointer items-center justify-between text-left" onClick={toggle}>
        <p className="font-mono text-[11px] tracking-wide text-ink-faint uppercase">Searchability check</p>
        <span className="text-xs font-medium text-muted-foreground">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="mt-3">
          {loading && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner className="size-4" /> Checking the current export…
            </p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {checks && !loading && (
            <ul className="flex flex-col gap-2">
              {checks.map((check) => (
                <li key={check.id} className="flex items-center gap-2 text-sm">
                  {check.passed ? (
                    <Check className="size-4 shrink-0 text-emerald-500" />
                  ) : (
                    <X className="size-4 shrink-0 text-destructive" />
                  )}
                  <span className={check.passed ? "text-foreground" : "text-destructive"}>{check.label}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
