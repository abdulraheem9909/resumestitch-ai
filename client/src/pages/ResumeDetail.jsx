import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ListChecks, X } from "lucide-react";
import { RESUMES_API } from "../lib/api.js";
import Breadcrumbs from "../components/Breadcrumbs.jsx";
import { Alert, AlertDescription } from "@/components/ui/alert";
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

function groupBulletsByRole(bullets) {
  const groups = [];
  const groupsByKey = new Map();

  for (const bullet of bullets) {
    const key = `${bullet.role || ""}|${bullet.company || ""}|${bullet.dateRange || ""}`;
    let group = groupsByKey.get(key);
    if (!group) {
      group = { role: bullet.role, company: bullet.company, dateRange: bullet.dateRange, bullets: [] };
      groupsByKey.set(key, group);
      groups.push(group);
    }
    group.bullets.push(bullet);
  }

  return groups;
}

export default function ResumeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [resume, setResume] = useState(null);
  const [verifiedSkills, setVerifiedSkills] = useState([]);
  const [skillMatchTypes, setSkillMatchTypes] = useState({});
  const [bullets, setBullets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [skillInput, setSkillInput] = useState("");
  const [savingSkills, setSavingSkills] = useState(false);

  useEffect(() => {
    async function loadResume() {
      setLoading(true);
      setError("");
      try {
        const [resumeRes, bulletsRes] = await Promise.all([
          fetch(`${RESUMES_API}/${id}`),
          fetch(`${RESUMES_API}/${id}/bullets`),
        ]);
        const resumeData = await resumeRes.json();
        if (!resumeRes.ok) throw new Error(resumeData.error || "Couldn't load this resume.");
        const bulletsData = await bulletsRes.json();
        if (!bulletsRes.ok) throw new Error(bulletsData.error || "Couldn't load this resume's experience.");

        setResume(resumeData.masterResume);
        setVerifiedSkills(resumeData.verifiedSkills || []);
        setSkillMatchTypes(resumeData.skillMatchTypes || {});
        setBullets(bulletsData.resumeBullets);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadResume();
  }, [id]);

  // Permanent edit — same PATCH /:id/profile endpoint the Resumes list page's
  // edit dialog already uses, but applied live per chip instead of batched
  // behind a Save button, matching the Approval page's skill-editing UX.
  // That endpoint doesn't return verifiedSkills, so re-fetch the resume
  // detail afterward to get a fresh solid/outline read on the updated list.
  async function updateSkills(nextSkills) {
    setSavingSkills(true);
    setError("");
    try {
      const res = await fetch(`${RESUMES_API}/${id}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skills: nextSkills }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't update skills.");
      setResume(data.masterResume);

      const refreshed = await fetch(`${RESUMES_API}/${id}`);
      const refreshedData = await refreshed.json();
      if (refreshed.ok) {
        setVerifiedSkills(refreshedData.verifiedSkills || []);
        setSkillMatchTypes(refreshedData.skillMatchTypes || {});
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingSkills(false);
    }
  }

  function addSkill() {
    const value = skillInput.trim();
    if (!value || (resume?.skills || []).includes(value)) {
      setSkillInput("");
      return;
    }
    updateSkills([...(resume?.skills || []), value]);
    setSkillInput("");
  }

  function removeSkill(skill) {
    updateSkills((resume?.skills || []).filter((existing) => existing !== skill));
  }

  const contactLine = resume
    ? [resume.personalInfo?.location, resume.personalInfo?.phone, resume.personalInfo?.email, resume.personalInfo?.linkedin, resume.personalInfo?.portfolio]
        .filter(Boolean)
        .join(" · ")
    : "";

  const experience = groupBulletsByRole(bullets);

  return (
    <section className="mx-auto w-full max-w-5xl">
      <div className="sticky top-0 z-10 bg-background pb-10  pt-7 md:pt-10 px=1 md:px-2" >
        <Breadcrumbs
          backTo="/resumes"
          trail={[
            { label: "Master Resumes", to: "/resumes" },
            { label: resume?.personalInfo?.fullName || resume?.label || "Resume" },
          ]}
        />
        {resume && (
          <>
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="mb-2.5 font-mono text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {resume.personalInfo?.title || "Master resume"}
                </p>
                <h1 className="font-display text-2xl font-semibold text-foreground md:text-3xl">
                  {resume.personalInfo?.fullName || resume.label}
                </h1>
              </div>
              <Button size="sm" className="w-fit" onClick={() => navigate(`/resumes/${id}/bullets`)}>
                <ListChecks className="size-4" /> Resume Bullets
              </Button>
            </div>
            {contactLine && <p className="max-w-prose text-sm text-muted-foreground md:text-base">{contactLine}</p>}
          </>
        )}
      </div>

      {error && (
        <Alert variant="destructive" className="mb-5">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {loading && <p className="py-4 text-sm text-muted-foreground">Loading this resume…</p>}

      {!loading && resume && (
        <>
          {resume.summary && (
            <div className="mb-6 rounded-lg border border-border bg-card p-5 shadow-card">
              <p className="mb-3 font-mono text-[11px] tracking-wide text-ink-faint uppercase">Summary</p>
              <p className="text-sm text-foreground">{resume.summary}</p>
            </div>
          )}

          {experience.length > 0 && (
            <div className="mb-6 rounded-lg border border-border bg-card p-5 shadow-card">
              <p className="mb-3 font-mono text-[11px] tracking-wide text-ink-faint uppercase">Experience</p>
              <ul className="flex flex-col gap-5">
                {experience.map((group, index) => (
                  <li key={index}>
                    <p className="text-sm font-medium text-foreground">
                      {[group.company, group.role].filter(Boolean).join(" — ") || "Untitled role"}
                    </p>
                    {group.dateRange && (
                      <p className="mb-2 font-mono text-[11px] tracking-wide text-ink-faint uppercase">
                        {group.dateRange}
                      </p>
                    )}
                    <ul className="flex list-disc flex-col gap-1 pl-4">
                      {group.bullets.map((bullet) => (
                        <li key={bullet._id} className="text-sm text-foreground">
                          {bullet.text}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {resume.education?.length > 0 && (
            <div className="mb-6 rounded-lg border border-border bg-card p-5 shadow-card">
              <p className="mb-3 font-mono text-[11px] tracking-wide text-ink-faint uppercase">Education</p>
              <ul className="flex flex-col gap-3">
                {resume.education.map((entry, index) => (
                  <li key={index}>
                    <p className="text-sm font-medium text-foreground">{entry.degree}</p>
                    <p className="font-mono text-[11px] tracking-wide text-ink-faint uppercase">
                      {[entry.institution, entry.location, entry.dateRange].filter(Boolean).join(" · ")}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {resume.projects?.length > 0 && (
            <div className="mb-6 rounded-lg border border-border bg-card p-5 shadow-card">
              <p className="mb-3 font-mono text-[11px] tracking-wide text-ink-faint uppercase">Projects</p>
              <ul className="flex flex-col gap-3">
                {resume.projects.map((entry, index) => (
                  <li key={index}>
                    <p className="text-sm font-medium text-foreground">{entry.name}</p>
                    <p className="text-sm text-muted-foreground">{entry.description}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-lg border border-border bg-card p-5 shadow-card">
            <p className="mb-3 font-mono text-[11px] tracking-wide text-ink-faint uppercase">Skills</p>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {(resume.skills || []).length === 0 ? (
                <span className="text-sm text-muted-foreground">No skills listed.</span>
              ) : (
                resume.skills.map((skill) => (
                  <Badge
                    key={skill}
                    variant={verifiedSkills.includes(skill) ? "default" : "outline"}
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
                      onClick={() => removeSkill(skill)}
                      disabled={savingSkills}
                      className="rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
                      aria-label={`Remove ${skill}`}
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))
              )}
            </div>
            <div className="flex gap-2">
              <Input
                value={skillInput}
                onChange={(event) => setSkillInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addSkill();
                  }
                }}
                placeholder="Add a skill…"
                className="max-w-xs"
                disabled={savingSkills}
              />
              <Button size="sm" variant="outline" onClick={addSkill} disabled={savingSkills || !skillInput.trim()}>
                Add
              </Button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
