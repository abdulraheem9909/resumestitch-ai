import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronDown, Download, Pencil, Trash2, X } from "lucide-react";
import { RESUMES_API } from "../lib/api.js";
import { apiFetch } from "../lib/apiFetch.js";
import { downloadFile } from "../lib/downloadFile.js";
import { isPersonalInfoValid } from "../lib/personalInfo.js";
import Breadcrumbs from "../components/Breadcrumbs.jsx";
import { DownloadOverlay } from "../components/DownloadOverlay.jsx";
import { EditableEntryList } from "../components/EditableEntryList.jsx";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const EMPTY_PERSONAL_INFO = {
  fullName: "",
  title: "",
  location: "",
  phone: "",
  email: "",
  linkedin: "",
  portfolio: "",
};

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

const EDUCATION_FIELDS = [
  { key: "degree", label: "Degree", required: true },
  { key: "institution", label: "Institution", required: true },
  { key: "location", label: "Location" },
  { key: "dateRange", label: "Date range", type: "monthRange", currentLabel: "Currently studying here", required: true },
];

const PROJECT_FIELDS = [
  { key: "name", label: "Name" },
  { key: "description", label: "Description", type: "textarea" },
];

const CERTIFICATION_FIELDS = [
  { key: "name", label: "Name", required: true },
  { key: "issuer", label: "Issuer", required: true },
  { key: "date", label: "Date", type: "month", required: true },
];

const VOLUNTEER_FIELDS = [
  { key: "role", label: "Role", required: true },
  { key: "organization", label: "Organization", required: true },
  { key: "dateRange", label: "Date range", type: "monthRange", currentLabel: "Currently volunteering here", required: true },
  { key: "description", label: "Description", type: "textarea", required: true },
];

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

  const [isEditingPersonalInfo, setIsEditingPersonalInfo] = useState(false);
  const [personalInfoDraft, setPersonalInfoDraft] = useState(EMPTY_PERSONAL_INFO);
  const [savingPersonalInfo, setSavingPersonalInfo] = useState(false);

  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState("");
  const [savingSummary, setSavingSummary] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    async function loadResume() {
      setLoading(true);
      setError("");
      try {
        const [resumeRes, bulletsRes] = await Promise.all([
          apiFetch(`${RESUMES_API}/${id}`),
          apiFetch(`${RESUMES_API}/${id}/bullets`),
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

  // Shared write path for every field this page edits — personalInfo,
  // summary, education, projects, certifications, volunteerWork, and skills
  // all go through the same PATCH /:id/profile route. That route doesn't
  // return verifiedSkills, so re-fetch the resume detail afterward to get a
  // fresh solid/outline read on whatever changed.
  async function updateProfileField(field, value) {
    const res = await apiFetch(`${RESUMES_API}/${id}/profile`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Couldn't save these changes.");
    setResume(data.masterResume);

    const refreshed = await apiFetch(`${RESUMES_API}/${id}`);
    const refreshedData = await refreshed.json();
    if (refreshed.ok) {
      setVerifiedSkills(refreshedData.verifiedSkills || []);
      setSkillMatchTypes(refreshedData.skillMatchTypes || {});
    }
  }

  async function updateSkills(nextSkills) {
    setSavingSkills(true);
    setError("");
    try {
      await updateProfileField("skills", nextSkills);
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

  async function deleteResume() {
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await apiFetch(`${RESUMES_API}/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't delete this resume.");
      navigate("/resumes");
    } catch (err) {
      setDeleteError(err.message);
      setDeleting(false);
    }
  }

  function startEditingPersonalInfo() {
    setPersonalInfoDraft({ ...EMPTY_PERSONAL_INFO, ...resume.personalInfo });
    setIsEditingPersonalInfo(true);
    setError("");
  }

  async function savePersonalInfo() {
    if (!isPersonalInfoValid(personalInfoDraft)) return;
    setSavingPersonalInfo(true);
    setError("");
    try {
      await updateProfileField("personalInfo", personalInfoDraft);
      setIsEditingPersonalInfo(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingPersonalInfo(false);
    }
  }

  function startEditingSummary() {
    setSummaryDraft(resume.summary || "");
    setIsEditingSummary(true);
    setError("");
  }

  async function saveSummary() {
    setSavingSummary(true);
    setError("");
    try {
      await updateProfileField("summary", summaryDraft);
      setIsEditingSummary(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingSummary(false);
    }
  }

  const contactLine = resume
    ? [resume.personalInfo?.location, resume.personalInfo?.phone, resume.personalInfo?.email, resume.personalInfo?.linkedin, resume.personalInfo?.portfolio]
        .filter(Boolean)
        .join(" · ")
    : "";

  const experience = groupBulletsByRole(bullets);

  // The export route rebuilds the .docx/.pdf fresh on every request, so
  // this can take a moment — the overlay/disabled button are the only
  // sign a click landed.
  async function handleDownload(url, filename) {
    setDownloading(true);
    setError("");
    try {
      await downloadFile(url, filename);
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-5xl">
      {downloading && <DownloadOverlay />}
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
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="mb-2.5 font-mono text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {resume.personalInfo?.title || "Master resume"}
                </p>
                <div className="flex items-center gap-1.5">
                  <h1 className="font-display text-2xl font-semibold text-foreground md:text-3xl">
                    {resume.personalInfo?.fullName || resume.label}
                  </h1>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={startEditingPersonalInfo}
                    aria-label="Edit details"
                  >
                    <Pencil className="size-4" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" disabled={downloading}>
                      <Download className="size-4" /> Download
                      <ChevronDown className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-48">
                    <DropdownMenuItem
                      disabled={downloading}
                      onClick={() => handleDownload(`${RESUMES_API}/${id}/export/resume.docx`, "resume.docx")}
                    >
                      Word (.docx)
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={downloading}
                      onClick={() => handleDownload(`${RESUMES_API}/${id}/export/resume.pdf`, "resume.pdf")}
                    >
                      PDF (.pdf)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  <Trash2 className="size-4" /> Delete
                </Button>
              </div>
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
          {isEditingPersonalInfo && (
            <div className="mb-6 rounded-lg border border-border bg-card p-5 shadow-card">
              <p className="mb-3 font-mono text-[11px] tracking-wide text-ink-faint uppercase">Contact details</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 flex flex-col gap-1.5">
                  <Label htmlFor="rd-fullName">Full name</Label>
                  <Input
                    id="rd-fullName"
                    value={personalInfoDraft.fullName}
                    onChange={(event) => setPersonalInfoDraft((prev) => ({ ...prev, fullName: event.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="rd-title">Title</Label>
                  <Input
                    id="rd-title"
                    value={personalInfoDraft.title}
                    onChange={(event) => setPersonalInfoDraft((prev) => ({ ...prev, title: event.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="rd-location">Location</Label>
                  <Input
                    id="rd-location"
                    value={personalInfoDraft.location}
                    onChange={(event) => setPersonalInfoDraft((prev) => ({ ...prev, location: event.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="rd-phone">Phone</Label>
                  <Input
                    id="rd-phone"
                    value={personalInfoDraft.phone}
                    onChange={(event) => setPersonalInfoDraft((prev) => ({ ...prev, phone: event.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="rd-email">Email</Label>
                  <Input
                    id="rd-email"
                    value={personalInfoDraft.email}
                    onChange={(event) => setPersonalInfoDraft((prev) => ({ ...prev, email: event.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="rd-linkedin">LinkedIn</Label>
                  <Input
                    id="rd-linkedin"
                    value={personalInfoDraft.linkedin}
                    onChange={(event) => setPersonalInfoDraft((prev) => ({ ...prev, linkedin: event.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="rd-portfolio">Portfolio</Label>
                  <Input
                    id="rd-portfolio"
                    value={personalInfoDraft.portfolio}
                    onChange={(event) => setPersonalInfoDraft((prev) => ({ ...prev, portfolio: event.target.value }))}
                  />
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={savePersonalInfo} disabled={savingPersonalInfo || !isPersonalInfoValid(personalInfoDraft)}>
                  {savingPersonalInfo ? "Saving…" : "Save"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setIsEditingPersonalInfo(false)} disabled={savingPersonalInfo}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          <div className="mb-6 rounded-lg border border-border bg-card p-5 shadow-card">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="font-mono text-[11px] tracking-wide text-ink-faint uppercase">Summary</p>
              {!isEditingSummary && (
                <Button variant="ghost" size="icon-sm" onClick={startEditingSummary}>
                  <Pencil className="size-4" />
                </Button>
              )}
            </div>
            {isEditingSummary ? (
              <div className="flex flex-col gap-3">
                <Textarea value={summaryDraft} onChange={(event) => setSummaryDraft(event.target.value)} rows={4} autoFocus />
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveSummary} disabled={savingSummary}>
                    {savingSummary ? "Saving…" : "Save"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setIsEditingSummary(false)} disabled={savingSummary}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-foreground">{resume.summary || "No summary yet."}</p>
            )}
          </div>

          <div className="mb-6 rounded-lg border border-border bg-card p-5 shadow-card">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="font-mono text-[11px] tracking-wide text-ink-faint uppercase">Experience</p>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => navigate(`/resumes/${id}/bullets`)}
                aria-label="Edit Bullets"
              >
                <Pencil className="size-4" />
              </Button>
            </div>
            {experience.length === 0 ? (
              <p className="text-sm text-muted-foreground">No bullets yet.</p>
            ) : (
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
            )}
          </div>

          <EditableEntryList
            title="Education"
            entries={resume.education || []}
            fields={EDUCATION_FIELDS}
            onSave={(next) => updateProfileField("education", next)}
            emptyMessage="No education listed."
            addLabel="Add education"
            renderSummary={(entry) => (
              <>
                <p className="text-sm font-medium text-foreground">{entry.degree}</p>
                <p className="font-mono text-[11px] tracking-wide text-ink-faint uppercase">
                  {[entry.institution, entry.location, entry.dateRange].filter(Boolean).join(" · ")}
                </p>
              </>
            )}
          />

          <EditableEntryList
            title="Certifications"
            entries={resume.certifications || []}
            fields={CERTIFICATION_FIELDS}
            onSave={(next) => updateProfileField("certifications", next)}
            emptyMessage="No certifications listed."
            addLabel="Add certification"
            renderSummary={(entry) => (
              <>
                <p className="text-sm font-medium text-foreground">{entry.name}</p>
                <p className="font-mono text-[11px] tracking-wide text-ink-faint uppercase">
                  {[entry.issuer, entry.date].filter(Boolean).join(" · ")}
                </p>
              </>
            )}
          />

          <EditableEntryList
            title="Projects"
            entries={resume.projects || []}
            fields={PROJECT_FIELDS}
            onSave={(next) => updateProfileField("projects", next)}
            emptyMessage="No projects listed."
            addLabel="Add project"
            renderSummary={(entry) => (
              <>
                <p className="text-sm font-medium text-foreground">{entry.name}</p>
                <p className="text-sm text-muted-foreground">{entry.description}</p>
              </>
            )}
          />

          <EditableEntryList
            title="Volunteer Work"
            entries={resume.volunteerWork || []}
            fields={VOLUNTEER_FIELDS}
            onSave={(next) => updateProfileField("volunteerWork", next)}
            emptyMessage="No volunteer work listed."
            addLabel="Add volunteer work"
            renderSummary={(entry) => (
              <>
                <p className="text-sm font-medium text-foreground">{entry.role}</p>
                <p className="font-mono text-[11px] tracking-wide text-ink-faint uppercase">
                  {[entry.organization, entry.dateRange].filter(Boolean).join(" · ")}
                </p>
                {entry.description && <p className="mt-1 text-sm text-muted-foreground">{entry.description}</p>}
              </>
            )}
          />

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

      <Dialog open={deleteDialogOpen} onOpenChange={(open) => !open && !deleting && setDeleteDialogOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete "{resume?.label}"?</DialogTitle>
            <DialogDescription>
              This permanently deletes this resume, every bullet in it, and every application ever
              run against it — including their tailored resumes, cover letters, and scoring
              history. This can't be undone.
            </DialogDescription>
          </DialogHeader>

          {deleteError && (
            <Alert variant="destructive">
              <AlertDescription>{deleteError}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteResume} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
