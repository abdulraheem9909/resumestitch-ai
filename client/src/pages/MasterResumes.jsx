import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { RESUMES_API } from "../lib/api.js";
import { isPersonalInfoValid } from "../lib/personalInfo.js";
import { EmptyState } from "../components/EmptyState.jsx";
import { LoadingState } from "../components/LoadingState.jsx";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const EMPTY_PERSONAL_INFO = {
  fullName: "",
  title: "",
  location: "",
  phone: "",
  email: "",
  linkedin: "",
  portfolio: "",
};

export default function MasterResumes() {
  const [masterResumes, setMasterResumes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [file, setFile] = useState(null);
  const [parsingFile, setParsingFile] = useState(false);
  const [formLabel, setFormLabel] = useState("");
  const [personalInfo, setPersonalInfo] = useState(EMPTY_PERSONAL_INFO);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const [editTarget, setEditTarget] = useState(null);
  const [editLabel, setEditLabel] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");

  useEffect(() => {
    async function loadResumes() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(RESUMES_API);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Couldn't load your resumes.");
        setMasterResumes(data.masterResumes);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadResumes();
  }, []);

  function updatePersonalInfoField(field) {
    return (event) => setPersonalInfo((prev) => ({ ...prev, [field]: event.target.value }));
  }

  // Prefill-only — pulls personalInfo + a suggested label out of the file the
  // moment it's picked, so the fields below start populated instead of blank.
  // Never overwrites anything already typed, and nothing is saved until the
  // user reviews the fields and clicks Upload.
  async function handleFileChange(event) {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    if (!selected) return;

    setParsingFile(true);
    setUploadError("");
    try {
      const body = new FormData();
      body.append("file", selected);
      const res = await fetch(`${RESUMES_API}/parse-preview`, { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't read this file.");

      setFormLabel((prev) => (prev.trim() ? prev : data.suggestedLabel || ""));
      setPersonalInfo((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(EMPTY_PERSONAL_INFO)) {
          if (!next[key]?.trim() && data.personalInfo?.[key]) next[key] = data.personalInfo[key];
        }
        return next;
      });
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setParsingFile(false);
    }
  }

  async function uploadResume() {
    if (!file || !formLabel.trim() || !isPersonalInfoValid(personalInfo)) return;

    setUploading(true);
    setUploadError("");
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("label", formLabel);
      Object.entries(personalInfo).forEach(([key, value]) => body.append(key, value));

      const res = await fetch(RESUMES_API, { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't upload this resume.");

      setMasterResumes((prev) => [data.masterResume, ...prev]);
      setIsUploadOpen(false);
      setFile(null);
      setFormLabel("");
      setPersonalInfo(EMPTY_PERSONAL_INFO);
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function deleteResume() {
    if (!deleteTarget) return;

    setDeleting(true);
    setDeleteError("");
    try {
      const res = await fetch(`${RESUMES_API}/${deleteTarget._id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't delete this resume.");

      setMasterResumes((prev) => prev.filter((resume) => resume._id !== deleteTarget._id));
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  function startEditing(resume) {
    setEditTarget(resume);
    setEditLabel(resume.label);
    setEditError("");
  }

  // Full contact-detail editing lives on the resume's own detail page now
  // (client/src/pages/ResumeDetail.jsx) — this dialog only renames the
  // resume, via the rename route that already existed but had no caller.
  async function saveEdit() {
    if (!editTarget || !editLabel.trim()) return;

    setSavingEdit(true);
    setEditError("");
    try {
      const res = await fetch(`${RESUMES_API}/${editTarget._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: editLabel }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't rename this resume.");

      setMasterResumes((prev) =>
        prev.map((resume) => (resume._id === editTarget._id ? data.masterResume : resume))
      );
      setEditTarget(null);
    } catch (err) {
      setEditError(err.message);
    } finally {
      setSavingEdit(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-5xl">
      <div className="sticky top-0 z-10 bg-background pb-10 pt-7 md:pt-10 px-1 md:px-2">
        <p className="mb-2.5 font-mono text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Master resumes
        </p>
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="font-display text-2xl font-semibold text-foreground md:text-3xl">Master resumes</h1>
          <Button size="sm" className="w-fit cursor-pointer" onClick={() => setIsUploadOpen(true)}>
            <Plus className="size-4" /> Upload resume
          </Button>
        </div>
        <p className="max-w-prose text-sm text-muted-foreground md:text-base">
          Click a resume to view and edit it, or manage it from here — rename it, or delete it
          along with everything ever run against it.
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-5">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {loading && <LoadingState message="Loading your resumes…" />}

      {!loading && masterResumes.length === 0 && !error && (
        <EmptyState
          icon={FileText}
          title="No resumes yet"
          description="Upload a resume to start tailoring applications against it."
          action={
            <Button size="sm" onClick={() => setIsUploadOpen(true)}>
              <Plus className="size-4" /> Upload resume
            </Button>
          }
        />
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-1">
        {masterResumes.map((resume) => (
          <div
            key={resume._id}
            role="button"
            tabIndex={0}
            onClick={() => navigate(`/resumes/${resume._id}`)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                navigate(`/resumes/${resume._id}`);
              }
            }}
            className="relative flex flex-col items-start gap-1.5 rounded-lg border border-border bg-card p-5 text-left shadow-card transition-all hover:-translate-y-0.5 hover:border-primary hover:bg-secondary/40 hover:shadow-[0_2px_4px_rgba(22,33,27,0.06),0_12px_28px_-12px_rgba(22,33,27,0.22)] focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none cursor-pointer"
          >
            <div className="absolute top-3 right-3 flex gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="text-foreground hover:text-foreground cursor-pointer"
                onClick={(event) => {
                  event.stopPropagation();
                  startEditing(resume);
                }}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="text-destructive hover:text-destructive cursor-pointer"
                onClick={(event) => {
                  event.stopPropagation();
                  setDeleteTarget(resume);
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
            <span className="font-display pr-16 text-base font-semibold text-foreground">
              {resume.label}
            </span>
            <span className="font-mono text-[11px] tracking-wide text-ink-faint uppercase">
              Uploaded {new Date(resume.uploadedAt).toLocaleDateString()}
            </span>
          </div>
        ))}
      </div>

      <Dialog open={isUploadOpen} onOpenChange={(open) => !uploading && setIsUploadOpen(open)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload a resume</DialogTitle>
            <DialogDescription>
              We'll pull bullets and skills for tailoring — everything else here is stored as-is.
            </DialogDescription>
          </DialogHeader>

          {uploading ? (
            <div className="flex min-h-[26rem] items-center justify-center">
              <LoadingState
                message="Reading your resume and tagging its skills. This can take a moment."
                steps={["Reading your resume", "Finding your bullets and sections", "Tagging skills for each bullet", "Saving your resume"]}
                className="border-0 bg-transparent p-0 shadow-none"
              />
            </div>
          ) : (
            <>
              {uploadError && (
                <Alert variant="destructive">
                  <AlertDescription>{uploadError}</AlertDescription>
                </Alert>
              )}

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="resume-file">Resume file (.pdf or .docx)</Label>
                <input
                  id="resume-file"
                  type="file"
                  accept=".pdf,.docx"
                  onChange={handleFileChange}
                  className="text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-secondary-foreground"
                />
                {parsingFile && <p className="text-xs text-muted-foreground">Reading file to pre-fill the fields below…</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="resume-label">Label</Label>
                <Input
                  id="resume-label"
                  value={formLabel}
                  onChange={(event) => setFormLabel(event.target.value)}
                  placeholder="e.g. Full-stack CV"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 flex flex-col gap-1.5">
                  <Label htmlFor="pi-fullName">Full name</Label>
                  <Input id="pi-fullName" value={personalInfo.fullName} onChange={updatePersonalInfoField("fullName")} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="pi-title">Title</Label>
                  <Input id="pi-title" value={personalInfo.title} onChange={updatePersonalInfoField("title")} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="pi-location">Location</Label>
                  <Input id="pi-location" value={personalInfo.location} onChange={updatePersonalInfoField("location")} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="pi-phone">Phone</Label>
                  <Input id="pi-phone" value={personalInfo.phone} onChange={updatePersonalInfoField("phone")} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="pi-email">Email</Label>
                  <Input id="pi-email" value={personalInfo.email} onChange={updatePersonalInfoField("email")} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="pi-linkedin">LinkedIn</Label>
                  <Input id="pi-linkedin" value={personalInfo.linkedin} onChange={updatePersonalInfoField("linkedin")} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="pi-portfolio">Portfolio</Label>
                  <Input id="pi-portfolio" value={personalInfo.portfolio} onChange={updatePersonalInfoField("portfolio")} />
                </div>
              </div>

              <DialogFooter>
                <Button
                  onClick={uploadResume}
                  disabled={parsingFile || !file || !formLabel.trim() || !isPersonalInfoValid(personalInfo)}
                >
                  Upload
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete "{deleteTarget?.label}"?</DialogTitle>
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
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteResume} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editTarget} onOpenChange={(open) => !open && !savingEdit && setEditTarget(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Rename "{editTarget?.label}"</DialogTitle>
            <DialogDescription>
              Contact details, summary, education, and everything else are edited from the resume's
              own page.
            </DialogDescription>
          </DialogHeader>

          {editError && (
            <Alert variant="destructive">
              <AlertDescription>{editError}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-label">Label</Label>
            <Input id="edit-label" value={editLabel} onChange={(event) => setEditLabel(event.target.value)} />
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditTarget(null)} disabled={savingEdit}>
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={savingEdit || !editLabel.trim()}>
              {savingEdit ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
