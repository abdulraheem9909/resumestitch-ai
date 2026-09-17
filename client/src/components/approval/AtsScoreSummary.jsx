import { Badge } from "@/components/ui/badge";
import { ScoreGauge } from "./ScoreGauge.jsx";
import { FlagBadge } from "./FlagBadge.jsx";
import { InfoTooltip } from "./InfoTooltip.jsx";

// Sidebar half of the ATS score card — just the gauge and current flags, a
// quick at-a-glance widget. The recruiter's written feedback, the re-check
// action, and retry/updated badges live in AtsFeedbackCard (main column)
// instead. Both read the same currentAtsScore/currentAtsFlags computed once
// in Approval.jsx — nothing about how those values are derived changed,
// only which component renders which part of the original ATS score card.
export function AtsScoreSummary({ currentAtsScore, currentAtsFlags }) {
  return (
    <div className="mb-4 md:mb-6 rounded-lg border border-border bg-card p-4 md:p-5 shadow-card">
      <div className="mb-3 flex items-center gap-1.5">
        <p className="font-mono text-[11px] tracking-wide text-ink-faint uppercase">ATS score</p>
        <InfoTooltip text="A score from 0 to 100 showing how well this resume matches the job description. It's only a guide. A low score never blocks approval." />
      </div>
      <div className="flex flex-col items-center gap-3">
        <ScoreGauge score={currentAtsScore} label="ATS score" />
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {currentAtsFlags.length === 0 ? (
            <Badge variant="secondary">No flags raised</Badge>
          ) : (
            <>
              {currentAtsFlags.map((flag) => (
                <FlagBadge key={flag} flag={flag} />
              ))}
              <InfoTooltip
                text={
                  <ul className="list-disc space-y-1 pl-3">
                    <li>missingRequirement: a job requirement isn't mentioned in your resume.</li>
                    <li>unsupportedClaim: something isn't backed by your original bullets.</li>
                    <li>excessiveRewrite: a bullet's wording changed too much.</li>
                    <li>poorReadability: a sentence is awkward or unclear.</li>
                  </ul>
                }
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
