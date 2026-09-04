import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "../Spinner.jsx";
import { ScoreGauge } from "./ScoreGauge.jsx";
import { FlagBadge } from "./FlagBadge.jsx";

// ATS score & recruiter feedback — always shows whichever is current: the
// original AI pass, or the re-check once one has run. Never both at once.
export function AtsScoreCard({
  application,
  currentAtsScore,
  currentRecruiterFeedback,
  currentAtsFlags,
  hasRecheck,
  rechecking,
  busy,
  showOriginalFeedback,
  setShowOriginalFeedback,
  onRecheck,
}) {
  return (
    <div className="mb-6 rounded-lg border border-border bg-card p-5 shadow-card">
      <div className="mb-3 flex items-center justify-between gap-4">
        <p className="font-mono text-[11px] tracking-wide text-ink-faint uppercase">
          ATS score &amp; recruiter feedback
        </p>
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
      <p className="mb-3 text-sm text-muted-foreground">
        Re-runs fact-checking and ATS/recruiter scoring against whatever you've saved above.
        It's informational only — it doesn't gate approval and doesn't count as a retry.
      </p>

      <div className="mb-3 flex flex-wrap items-start gap-4">
        <ScoreGauge score={currentAtsScore} label="ATS score" />
        <div className="flex min-w-[200px] flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {hasRecheck && <Badge variant="secondary">Updated after your edit</Badge>}
            {application.retryCount > 0 && <Badge variant="outline">retries: {application.retryCount}</Badge>}
          </div>
          {currentRecruiterFeedback && (
            <p className="text-sm text-foreground">{currentRecruiterFeedback}</p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {currentAtsFlags.length === 0 ? (
              <Badge variant="secondary">No flags raised</Badge>
            ) : (
              currentAtsFlags.map((flag) => <FlagBadge key={flag} flag={flag} />)
            )}
          </div>
        </div>
      </div>

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
