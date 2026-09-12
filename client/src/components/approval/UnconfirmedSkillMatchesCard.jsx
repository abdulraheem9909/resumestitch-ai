import { Spinner } from "../Spinner.jsx";
import { Button } from "@/components/ui/button";

// One-click alternative to SuggestSkillsCard for the narrow case where a JD
// skill is already written, literally, in the tailored text — just not yet a
// recognized dictionary entry (e.g. tagBullet extracted a paraphrase like
// "System Architecture" from a bullet that actually says "system design").
// "Add" teaches the exact wording to the dictionary permanently; "Ignore" is
// remembered per user so the same coincidental match doesn't keep
// resurfacing on every future Re-check (Option B).
export function UnconfirmedSkillMatchesCard({ unconfirmedSkillMatches, pendingSkillAction, busy, onConfirm, onDismiss }) {
  return (
    <div className="mb-6 rounded-lg border border-border bg-card p-5 shadow-card">
      <p className="mb-1 font-mono text-[11px] tracking-wide text-ink-faint uppercase">
        Found in your resume, not yet recognized
      </p>
      <p className="mb-3 text-sm text-muted-foreground">
        These skills are literally written in your tailored text, but aren't a recognized skill yet — add them so
        Skills Matched and Skills Gap give you credit, or ignore a coincidental match.
      </p>
      <div className="flex flex-col gap-2">
        {unconfirmedSkillMatches.map((skill) => {
          const pending = pendingSkillAction === skill;
          return (
            <div key={skill} className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2">
              <span className="text-sm font-medium text-foreground">{skill}</span>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" disabled={busy || pending} onClick={() => onDismiss(skill)}>
                  Ignore
                </Button>
                <Button size="sm" disabled={busy || pending} onClick={() => onConfirm(skill)}>
                  {pending ? (
                    <>
                      <Spinner className="size-4" /> Adding…
                    </>
                  ) : (
                    "Add"
                  )}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
