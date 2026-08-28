import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { RESUMES_API } from "../lib/api.js";
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
  const [formLabel, setFormLabel] = useState("");
  const [personalInfo, setPersonalInfo] = useState(EMPTY_PERSONAL_INFO);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

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

  async function uploadResume() {
    if (!file || !formLabel.trim() || !personalInfo.fullName.trim()) return;

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

  return (
    <section className="mx-auto w-full max-w-4xl">
      <p className="mb-2.5 font-mono text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Master resumes
      </p>
      <div className="mb-3 flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-semibold text-foreground">Start an application</h1>
        <Button size="sm" onClick={() => setIsUploadOpen(true)}>
          <Plus className="size-4" /> Upload resume
        </Button>
      </div>
      <p className="mb-8 max-w-prose text-base text-muted-foreground">
        Pick which resume you're applying with to move on to the job description.
      </p>

      {error && (
        <Alert variant="destructive" className="mb-5">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {loading && <p className="py-4 text-sm text-muted-foreground">Loading your resumes…</p>}

      {!loading && masterResumes.length === 0 && !error && (
        <p className="py-4 text-sm text-muted-foreground">You haven't uploaded a resume yet.</p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {masterResumes.map((resume) => (
          <div
            key={resume._id}
            role="button"
            tabIndex={0}
            onClick={() => navigate(`/resumes/${resume._id}/apply`)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                navigate(`/resumes/${resume._id}/apply`);
              }
            }}
            className="relative flex flex-col items-start gap-1.5 rounded-lg border border-border bg-card p-5 text-left shadow-card transition-all hover:-translate-y-0.5 hover:border-primary hover:bg-secondary/40 hover:shadow-[0_2px_4px_rgba(22,33,27,0.06),0_12px_28px_-12px_rgba(22,33,27,0.22)] focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute top-3 right-3 text-muted-foreground hover:text-destructive"
              onClick={(event) => {
                event.stopPropagation();
                setDeleteTarget(resume);
              }}
            >
              <Trash2 className="size-4" />
            </Button>
            <span className="font-display pr-8 text-base font-semibold text-foreground">
              {resume.label}
            </span>
            <span className="font-mono text-[11px] tracking-wide text-ink-faint uppercase">
              Uploaded {new Date(resume.uploadedAt).toLocaleDateString()}
            </span>
          </div>
        ))}
      </div>

      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload a resume</DialogTitle>
            <DialogDescription>
              We'll pull bullets and skills for tailoring — everything else here is stored as-is.
            </DialogDescription>
          </DialogHeader>

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
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-secondary-foreground"
            />
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
              disabled={uploading || !file || !formLabel.trim() || !personalInfo.fullName.trim()}
            >
              {uploading ? "Uploading…" : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
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
    </section>
  );
}
