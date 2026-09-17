import { Check, TriangleAlert } from "lucide-react";
import { InfoTooltip } from "./InfoTooltip.jsx";

// Two small, purely-derived summary stats — every input is already on the
// page (tailoredBullets[].rejected, and the same role|company|dateRange
// grouping ExperienceSection already uses). No new backend call, no new
// field. Both are checking the same thing: did anything get silently
// dropped during tailoring — a bullet excluded, or a whole employer left
// unrepresented. (Renamed from "Resume health" — a third stat this card
// used to show, skill verification, now lives inside SkillsCard instead,
// right above the skill chips it describes.)
export function CoverageCheckCard({ application, bulletGroups }) {
  const tailoredBullets = application?.tailoredBullets || [];
  if (tailoredBullets.length === 0) return null;

  const keptBulletCount = tailoredBullets.filter((bullet) => !bullet.rejected).length;

  // Frontend-only sanity read of node 5's own ensureEveryEmployerRepresented
  // guarantee — not a re-invocation of it, just checking whether every
  // employer group (the same grouping ExperienceSection renders) still has
  // at least one kept bullet right now. A human manually excluding every
  // bullet for one employer after generation is a real, allowed state (node
  // 5 never reverses a deliberate human exclude) — this surfaces that
  // instead of silently hiding it.
  const employerGroups = bulletGroups.filter((group) => group.company);
  const missingEmployers = employerGroups.filter((group) => !group.bullets.some((bullet) => !bullet.rejected));
  const allRepresented = missingEmployers.length === 0;

  const percent = (count, total) => (total === 0 ? 0 : Math.round((count / total) * 100));

  return (
    <div className="mb-4 md:mb-6 rounded-lg border border-border bg-card p-4 md:p-5 shadow-card">
      <div className="mb-4 flex items-center gap-1.5">
        <p className="font-mono text-[11px] tracking-wide text-ink-faint uppercase">Coverage check</p>
        <InfoTooltip text="Checks that tailoring didn't drop anything by mistake. Every past employer still has at least one bullet, and this shows how many bullets are being exported." />
      </div>

      <div className="mb-4">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground">Bullets kept</p>
          <p className="text-xs font-medium tabular-nums text-foreground">
            {keptBulletCount} / {tailoredBullets.length}
          </p>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${percent(keptBulletCount, tailoredBullets.length)}%` }}
          />
        </div>
      </div>

      {employerGroups.length > 0 && (
        <div className="flex items-center gap-2 border-t border-border pt-3 text-sm">
          {allRepresented ? (
            <Check className="size-4 shrink-0 text-emerald-500" />
          ) : (
            <TriangleAlert className="size-4 shrink-0 text-destructive" />
          )}
          <span className={allRepresented ? "text-foreground" : "text-destructive"}>
            {allRepresented
              ? `All ${employerGroups.length} employers represented`
              : `${missingEmployers.length} of ${employerGroups.length} employers missing a kept bullet`}
          </span>
        </div>
      )}
    </div>
  );
}
