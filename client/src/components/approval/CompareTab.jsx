import { Badge } from "@/components/ui/badge";
import { EducationCard } from "./EducationCard.jsx";
import { ProjectsCard } from "./ProjectsCard.jsx";
import { CertificationsCard } from "./CertificationsCard.jsx";
import { VolunteerWorkCard } from "./VolunteerWorkCard.jsx";
import { InfoTooltip } from "./InfoTooltip.jsx";
import { InlineDiff } from "./InlineDiff.jsx";

function CompareCard({ title, children }) {
  return (
    <div className="mb-6 rounded-lg border border-border bg-card p-5 shadow-card">
      <h3 className="mb-3 font-display text-lg font-semibold text-foreground">{title}</h3>
      {children}
    </div>
  );
}

function UnchangedSectionNote({ Component, items, itemsProp }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mb-6">
      <Component {...{ [itemsProp]: items }} />
      <p className="-mt-4 mb-2 px-5 text-xs text-muted-foreground">
        Carried through to your approved resume unchanged — this section is never tailored per JD.
      </p>
    </div>
  );
}

// Whole-bullet diff for a bullet the model (or a human) excluded entirely —
// no word diff needed since the whole thing is gone from the export, same
// "Out of context — excluded" language BulletCard already uses.
function RemovedBullet({ text }) {
  return (
    <li className="rounded-lg border border-border bg-card p-4 shadow-card">
      <div className="mb-1.5 flex items-center gap-2">
        <Badge variant="destructive">Excluded from tailored resume</Badge>
      </div>
      <p className="rounded-sm bg-red-100 text-sm text-red-700 line-through dark:bg-red-500/20 dark:text-red-300">
        {text || "—"}
      </p>
    </li>
  );
}

export function CompareTab({
  application,
  masterResume,
  originalsById,
  originalSummary,
  originalEducation,
  originalProjects,
  originalCertifications,
  originalVolunteerWork,
  effectiveSkills,
  bulletGroups,
}) {
  const masterSkills = masterResume?.skills ?? [];
  const masterSkillSet = new Set(masterSkills);
  const effectiveSkillSet = new Set(effectiveSkills);
  const allSkills = [...new Set([...masterSkills, ...effectiveSkills])];

  return (
    <div>
      <div className="mb-5 flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-sm bg-emerald-500" />
          Added during tailoring
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-sm bg-red-500" />
          Removed / excluded
        </span>
        <InfoTooltip text="This tab compares your master resume as it was frozen when this application was created against the resume actually approved/exported here — not whatever your master resume looks like today." />
      </div>

      <CompareCard title="Title">
        <p className="text-sm text-foreground">
          <InlineDiff original={masterResume?.personalInfo?.title} revised={application.tailoredTitle?.finalText} />
        </p>
      </CompareCard>

      <CompareCard title="Summary">
        <p className="text-sm text-foreground">
          <InlineDiff original={originalSummary} revised={application.tailoredSummary?.finalText} />
        </p>
      </CompareCard>

      <CompareCard title="Experience">
        <div className="flex flex-col gap-5">
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
                {group.bullets.map((bullet) => {
                  const original = originalsById.get(bullet.sourceBulletId);
                  if (bullet.rejected) {
                    return <RemovedBullet key={bullet.bulletId} text={original?.text} />;
                  }
                  return (
                    <li key={bullet.bulletId} className="rounded-lg border border-border bg-card p-4 shadow-card">
                      <p className="text-sm text-foreground">
                        <InlineDiff original={original?.text} revised={bullet.finalText} />
                      </p>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </CompareCard>

      <UnchangedSectionNote Component={EducationCard} items={originalEducation} itemsProp="education" />
      <UnchangedSectionNote Component={CertificationsCard} items={originalCertifications} itemsProp="certifications" />
      <UnchangedSectionNote Component={ProjectsCard} items={originalProjects} itemsProp="projects" />
      <UnchangedSectionNote Component={VolunteerWorkCard} items={originalVolunteerWork} itemsProp="volunteerWork" />

      <CompareCard title="Skills">
        {allSkills.length === 0 ? (
          <p className="text-sm text-muted-foreground">No skills listed.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {allSkills.map((skill) => {
              const inMaster = masterSkillSet.has(skill);
              const inEffective = effectiveSkillSet.has(skill);
              if (inMaster && inEffective) {
                return (
                  <Badge key={skill} variant="outline">
                    {skill}
                  </Badge>
                );
              }
              if (inEffective) {
                return (
                  <Badge
                    key={skill}
                    variant="outline"
                    className="border-transparent bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-300"
                  >
                    {skill}
                  </Badge>
                );
              }
              return (
                <Badge
                  key={skill}
                  variant="outline"
                  className="border-transparent bg-red-100 text-red-700 line-through dark:bg-red-500/20 dark:text-red-300"
                >
                  {skill}
                </Badge>
              );
            })}
          </div>
        )}
      </CompareCard>
    </div>
  );
}
