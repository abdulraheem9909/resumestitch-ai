import { BulletCard } from "./BulletCard.jsx";

// Same role|company|dateRange grouping the .docx export already uses
// (server/src/services/exportResumeDocx.js) — keyed off each tailored bullet's
// source, so the on-screen preview matches the shape of the exported file.
export function groupTailoredBulletsByEmployer(tailoredBullets, originalsById) {
  const groups = [];
  const groupsByKey = new Map();
  for (const bullet of tailoredBullets) {
    const source = originalsById.get(bullet.sourceBulletId) || {};
    const key = `${source.role || ""}|${source.company || ""}|${source.dateRange || ""}`;
    let group = groupsByKey.get(key);
    if (!group) {
      group = { role: source.role, company: source.company, dateRange: source.dateRange, bullets: [] };
      groupsByKey.set(key, group);
      groups.push(group);
    }
    group.bullets.push(bullet);
  }
  return groups;
}

export function ExperienceSection({
  bulletGroups,
  originalsById,
  verificationByBulletId,
  applicationStatus,
  editingState,
  bulletActions,
}) {
  return (
    <>
      <h3 className="mb-3 font-display text-lg font-semibold text-foreground">Experience</h3>
      <div className="mb-6 flex flex-col gap-5">
        {bulletGroups.map((group, groupIndex) => (
          <div key={groupIndex}>
            {group.company && (
              <div className="mb-2">
                <p className="text-sm font-medium text-foreground">
                  {[group.company, group.role].filter(Boolean).join(" — ")}
                </p>
                {group.dateRange && (
                  <p className="font-mono text-[11px] tracking-wide text-ink-faint uppercase">
                    {group.dateRange}
                  </p>
                )}
              </div>
            )}
            <ul className="flex flex-col gap-3">
              {group.bullets.map((bullet) => (
                <BulletCard
                  key={bullet.bulletId}
                  bullet={bullet}
                  original={originalsById.get(bullet.sourceBulletId)}
                  verification={verificationByBulletId.get(bullet.bulletId)}
                  applicationStatus={applicationStatus}
                  editingState={editingState}
                  bulletActions={bulletActions}
                />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </>
  );
}
