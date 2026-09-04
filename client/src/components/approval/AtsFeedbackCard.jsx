import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "../Spinner.jsx";
import { ScoreGauge } from "./ScoreGauge.jsx";
import { FlagBadge } from "./FlagBadge.jsx";
import { InfoTooltip } from "./InfoTooltip.jsx";

// Main-column half of the ATS score card — the recruiter's written
// feedback, the re-check action, retry/updated badges, and the historical
// "Show original AI feedback" reveal. The gauge + current flags live in
// AtsScoreSummary (sidebar) instead — see that file's comment.
export function AtsFeedbackCard({
  application,
  currentRecruiterFeedback,
  hasRecheck,
  rechecking,
  busy,
  showOriginalFeedback,
  setShowOriginalFeedback,
  onRecheck,
}) {
  const canRecheck = application.status !== "approved";

  return (
    <div className="mb-6 rounded-lg border border-border bg-card p-5 shadow-card">
      <div className="mb-3 flex items-center justify-between gap-4">
        <p className="font-mono text-[11px] tracking-wide text-ink-faint uppercase">Recruiter feedback</p>
        {canRecheck && (
          <div className="flex items-center gap-2">
            <InfoTooltip text="Re-checks your current edits against the job description. It's informational only and never blocks approval or counts as a retry." />
            <Button size="sm" variant="outline" onClick={onRecheck} disabled={busy}>
              {rechecking ? (
                <>
                  <Spinner className="size-4" /> Re-checking…
                </>
              ) : (
                "Re-check edited text"
              )}
            </Button>
          </div>
        )}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {hasRecheck && <Badge variant="secondary">Updated after your edit</Badge>}
        {application.retryCount > 0 && (
          <>
            <Badge variant="outline">retries: {application.retryCount}</Badge>
            <InfoTooltip text="How many times this application was automatically retried while tailoring, for example when a pass missed a job requirement. Retries stop after 3." />
          </>
        )}
      </div>
      {currentRecruiterFeedback && <p className="text-sm text-foreground">{currentRecruiterFeedback}</p>}

      {hasRecheck && (
        <div className="mt-3 border-t border-border pt-3">
          <button
            type="button"
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
            onClick={() => setShowOriginalFeedback((prev) => !prev)}
          >
            {showOriginalFeedback ? "▾" : "▸"} Show original AI feedback
          </button>
          {showOriginalFeedback && (
            <div className="mt-2 flex flex-wrap items-start gap-3">
              <ScoreGauge score={application.atsScore} label="AI original" size={64} />
              <div className="flex min-w-[180px] flex-1 flex-col gap-2">
                {application.recruiterFeedback && (
                  <p className="text-sm text-muted-foreground">{application.recruiterFeedback}</p>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {(application.atsFlags || []).length === 0 ? (
                    <Badge variant="secondary">No flags raised</Badge>
                  ) : (
                    application.atsFlags.map((flag) => <FlagBadge key={flag} flag={flag} muted />)
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
