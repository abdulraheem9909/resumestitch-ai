import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// A skill can be "verified" two different ways: its own exact wording is in
// the bullet/summary/project text (safe even against a strict, literal-
// keyword-only ATS), or only a different alias of the same skill is (e.g. a
// "Node.js" badge backed by bullet text that only ever says "Node") — still
// genuinely true, but worth flagging since a literal keyword scanner
// elsewhere might not make the same connection.
function skillBadgeClassName(matchType) {
  if (matchType === "partial") {
    return "border-transparent bg-yellow-100 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-400";
  }
  return "";
}

export function SkillsCard({
  effectiveSkills,
  verifiedSkills,
  skillMatchTypes,
  skillInput,
  setSkillInput,
  busy,
  applicationStatus,
  onAddSkill,
  onRemoveSkill,
}) {
  const canEdit = applicationStatus !== "approved";
  // Same tally ResumeHealthCard's "Skill verification" used to show —
  // solid/partial/outline per-skill state, aggregated into counts. Reuses
  // the same effectiveSkills/verifiedSkills/skillMatchTypes this card
  // already receives, so no new props were needed to bring it in here.
  let verifiedCount = 0;
  let partialCount = 0;
  for (const skill of effectiveSkills) {
    if (!verifiedSkills.includes(skill)) continue;
    if (skillMatchTypes[skill] === "partial") partialCount += 1;
    else verifiedCount += 1;
  }
  const selfDeclaredCount = effectiveSkills.length - verifiedCount - partialCount;
  const totalSkills = effectiveSkills.length;
  const percent = (count, total) => (total === 0 ? 0 : Math.round((count / total) * 100));

  return (
    <div className="mb-6 rounded-lg border border-border bg-card p-5 shadow-card">
      <h3 className="mb-1 font-display text-lg font-semibold text-foreground">
        Skills <span className="font-normal text-muted-foreground">({totalSkills})</span>
      </h3>
      <p className="mb-3 text-xs text-muted-foreground">
        Editing here only changes this application's exported resume — your master resume's
        list is untouched.
      </p>

      {totalSkills > 0 && (
        <div className="mb-4">
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Skill verification</p>
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-emerald-500" style={{ width: `${percent(verifiedCount, totalSkills)}%` }} />
            <div className="h-full bg-yellow-500" style={{ width: `${percent(partialCount, totalSkills)}%` }} />
            <div
              className="h-full bg-muted-foreground/40"
              style={{ width: `${percent(selfDeclaredCount, totalSkills)}%` }}
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-500" />
              {verifiedCount} verified
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-yellow-500" />
              {partialCount} partial
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-muted-foreground/40" />
              {selfDeclaredCount} self-declared
            </span>
          </div>
        </div>
      )}

      <div className="mb-3 flex flex-wrap gap-1.5">
        {effectiveSkills.length === 0 ? (
          <span className="text-sm text-muted-foreground">No skills listed.</span>
        ) : (
          effectiveSkills.map((skill) => {
            const isVerified = verifiedSkills.includes(skill);
            return (
              <Badge
                key={skill}
                variant={isVerified ? "default" : "outline"}
                className={`gap-1 pr-1 ${skillBadgeClassName(skillMatchTypes[skill])}`}
                title={
                  skillMatchTypes[skill] === "partial"
                    ? "Genuinely backed by your experience, but only through different wording — this exact term isn't in your bullets."
                    : undefined
                }
              >
                {skill}
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => onRemoveSkill(skill)}
                    disabled={busy}
                    className="rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
                    aria-label={`Remove ${skill}`}
                  >
                    <X className="size-3" />
                  </button>
                )}
              </Badge>
            );
          })
        )}
      </div>
      {canEdit && (
        <div className="flex gap-2">
          <Input
            value={skillInput}
            onChange={(event) => setSkillInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onAddSkill();
              }
            }}
            placeholder="Add a skill…"
            className="max-w-xs"
            disabled={busy}
          />
          <Button size="sm" variant="outline" onClick={onAddSkill} disabled={busy || !skillInput.trim()}>
            Add
          </Button>
        </div>
      )}
    </div>
  );
}
