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
  onAddSkill,
  onRemoveSkill,
}) {
  return (
    <div className="mb-6 rounded-lg border border-border bg-card p-5 shadow-card">
      <h3 className="mb-1 font-display text-lg font-semibold text-foreground">Skills</h3>
      <p className="mb-3 text-xs text-muted-foreground">
        Editing here only changes this application's exported resume — your master resume's
        list is untouched.
      </p>
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
                <button
                  type="button"
                  onClick={() => onRemoveSkill(skill)}
                  disabled={busy}
                  className="rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
                  aria-label={`Remove ${skill}`}
                >
                  <X className="size-3" />
                </button>
              </Badge>
            );
          })
        )}
      </div>
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
    </div>
  );
}
