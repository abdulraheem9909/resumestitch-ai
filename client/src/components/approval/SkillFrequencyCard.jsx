import { useEffect, useState } from "react";
import { APPLICATIONS_API as API_BASE } from "../../lib/api.js";
import { apiFetch } from "../../lib/apiFetch.js";
import { Spinner } from "../Spinner.jsx";
import { SkillMatchBar } from "./SkillMatchBar.jsx";

// Purely informational, non-blocking — same pattern as
// SearchabilityCheckCard: open by default (still collapsible), fetched on
// mount, again on every manual reopen, and again whenever `refreshKey`
// changes (the application's own `updatedAt`, which every bullet/summary
// edit and Re-check already touch) — never gates approval/export, never
// writes anything. Without this, editing a bullet or clicking Re-check
// updated the skill-match bar and the "skills the job wants" list (both fed
// by the same `keywordGaps` prop, which the parent already refreshes) but
// left this card's own GET /:id/skill-frequency result stale until the page
// was fully reloaded, since its fetch only ever ran once on mount. GET
// /:id/skill-frequency counts each JD-requested canonical skill's
// occurrences in the JD text versus the current tailored resume text. Hosts
// the always-visible skill-match bar above its own collapsible detail table
// — the aggregate count sits right above the per-skill breakdown behind it.
export function SkillFrequencyCard({ applicationId, jdCanonicalSkills, keywordGaps, refreshKey }) {
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [skillFrequency, setSkillFrequency] = useState(null);

  async function runCheck() {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(`${API_BASE}/${applicationId}/skill-frequency`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't compute skill frequency.");
      setSkillFrequency(data.skillFrequency);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) runCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) runCheck();
  }

  return (
    <div className="mb-6 rounded-lg border border-border bg-card p-5 shadow-card">
      {jdCanonicalSkills?.length > 0 && (
        <div className="mb-4 border-b border-border pb-4">
          <SkillMatchBar jdCanonicalSkills={jdCanonicalSkills} keywordGaps={keywordGaps} />
        </div>
      )}

      <button type="button" className="flex w-full cursor-pointer items-center justify-between text-left" onClick={toggle}>
        <p className="font-mono text-[11px] tracking-wide text-ink-faint uppercase">Skill frequency</p>
        <span className="text-xs font-medium text-muted-foreground">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="mt-3">
          {loading && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner className="size-4" /> Counting skill mentions…
            </p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {skillFrequency && !loading && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-1.5 pr-4 font-mono text-[11px] tracking-wide text-ink-faint uppercase">Skill</th>
                    <th className="py-1.5 pr-4 font-mono text-[11px] tracking-wide text-ink-faint uppercase">Resume count</th>
                    <th className="py-1.5 font-mono text-[11px] tracking-wide text-ink-faint uppercase">JD count</th>
                  </tr>
                </thead>
                <tbody>
                  {skillFrequency.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-2 text-muted-foreground">
                        No JD skills recorded for this application.
                      </td>
                    </tr>
                  ) : (
                    skillFrequency.map((row) => (
                      <tr
                        key={row.skill}
                        className={`border-b border-border last:border-b-0${
                          row.resumeCount === 0 ? " bg-red-50 dark:bg-red-500/10" : ""
                        }`}
                      >
                        <td className="py-1.5 pr-4 text-foreground">{row.skill}</td>
                        <td
                          className={`py-1.5 pr-4 tabular-nums ${
                            row.resumeCount === 0 ? "text-red-700 dark:text-red-400" : "text-foreground"
                          }`}
                        >
                          {row.resumeCount}
                        </td>
                        <td className="py-1.5 tabular-nums text-foreground">{row.jdCount}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
