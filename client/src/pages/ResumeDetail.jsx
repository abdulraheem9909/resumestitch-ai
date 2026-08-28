import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ListChecks } from "lucide-react";
import { RESUMES_API } from "../lib/api.js";
import Breadcrumbs from "../components/Breadcrumbs.jsx";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
  const [bullets, setBullets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
        setBullets(bulletsData.resumeBullets);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadResume();
  }, [id]);

  const contactLine = resume
    ? [resume.personalInfo?.location, resume.personalInfo?.phone, resume.personalInfo?.email, resume.personalInfo?.linkedin, resume.personalInfo?.portfolio]
        .filter(Boolean)
        .join(" · ")
    : "";

  const experience = groupBulletsByRole(bullets);

  return (
    <section className="mx-auto w-full max-w-3xl">
      <Breadcrumbs
        backTo="/resumes"
        trail={[
          { label: "Master Resumes", to: "/resumes" },
          { label: resume?.personalInfo?.fullName || resume?.label || "Resume" },
        ]}
      />

      {error && (
        <Alert variant="destructive" className="mb-5">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {loading && <p className="py-4 text-sm text-muted-foreground">Loading this resume…</p>}

      {!loading && resume && (
        <>
          <div className="mb-3 flex items-center justify-between gap-4">
            <div>
              <p className="mb-2.5 font-mono text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {resume.personalInfo?.title || "Master resume"}
              </p>
              <h1 className="font-display text-3xl font-semibold text-foreground">
                {resume.personalInfo?.fullName || resume.label}
              </h1>
            </div>
            <Button size="sm" onClick={() => navigate(`/resumes/${id}/bullets`)}>
              <ListChecks className="size-4" /> Resume Bullets
            </Button>
          </div>
          {contactLine && <p className="mb-8 max-w-prose text-base text-muted-foreground">{contactLine}</p>}

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

          {resume.skills?.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-5 shadow-card">
              <p className="mb-3 font-mono text-[11px] tracking-wide text-ink-faint uppercase">Skills</p>
              <div className="flex flex-wrap gap-1.5">
                {resume.skills.map((skill) => (
                  <Badge key={skill} variant="secondary">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
