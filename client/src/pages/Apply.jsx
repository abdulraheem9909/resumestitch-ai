import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { APPLICATIONS_API, RESUMES_API } from "../lib/api.js";
import Breadcrumbs from "../components/Breadcrumbs.jsx";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export default function Apply() {
  const navigate = useNavigate();

  const [masterResumes, setMasterResumes] = useState([]);
  const [selectedResumeId, setSelectedResumeId] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [jdText, setJdText] = useState("");
  const [referenceUrl, setReferenceUrl] = useState("");
  const [coverLetterRequested, setCoverLetterRequested] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadResumes() {
      try {
        const res = await fetch(RESUMES_API);
        const data = await res.json();
        if (!res.ok)
          throw new Error(data.error || "Couldn't load your resumes.");
        setMasterResumes(data.masterResumes);
      } catch (err) {
        setError(err.message);
      }
    }
    loadResumes();
  }, []);

  async function submit() {
    if (!selectedResumeId || !companyName.trim() || !jdText.trim()) return;

    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(APPLICATIONS_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          masterResumeId: selectedResumeId,
          companyName,
          jdText,
          referenceUrl: referenceUrl || undefined,
          coverLetterRequested,
        }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(
          data.error || "Couldn't start tailoring for this job description.",
        );

      navigate(`/applications/${data.application._id}/approve`);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-5xl">
      <div className="sticky top-0 z-10 bg-background pb-10 pt-7 md:pt-10 px-1 md:px-2">
        <Breadcrumbs
          backTo="/applications"
          trail={[
            { label: "Applications", to: "/applications" },
            { label: "Start Application" },
          ]}
        />
        <h1 className="font-display mb-3 text-2xl font-semibold text-foreground md:text-3xl">
          Paste a job description
        </h1>
        <p className="max-w-prose text-sm text-muted-foreground md:text-base">
          Paste the job's text as-is — nothing is fetched from a URL. We'll
          extract what it's asking for, check it against the resume you pick, and
          tailor a draft for you to review.
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-5">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="apply-resume">Resume</Label>
          <Select value={selectedResumeId} onValueChange={setSelectedResumeId}>
            <SelectTrigger id="apply-resume" className="w-full">
              <SelectValue placeholder="Select a resume…" />
            </SelectTrigger>
            <SelectContent>
              {masterResumes.map((resume) => (
                <SelectItem key={resume._id} value={resume._id}>
                  {resume.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="jd-company">Company name</Label>
          <Input
            id="jd-company"
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            placeholder="e.g. Acme Corp"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="jd-reference">
            Reference link (optional, never fetched)
          </Label>
          <Input
            id="jd-reference"
            value={referenceUrl}
            onChange={(event) => setReferenceUrl(event.target.value)}
            placeholder="https://…"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="jd-text">Job description text</Label>
          <Textarea
            id="jd-text"
            value={jdText}
            onChange={(event) => setJdText(event.target.value)}
            rows={14}
            className="max-h-96 overflow-y-auto"
            placeholder="Paste the full job description here…"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            id="jd-cover-letter"
            type="checkbox"
            checked={coverLetterRequested}
            onChange={(event) => setCoverLetterRequested(event.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          <Label htmlFor="jd-cover-letter" className="cursor-pointer">
            Also generate a cover letter
          </Label>
        </div>

        <Button
          className="w-fit"
          onClick={submit}
          disabled={
            submitting ||
            !selectedResumeId ||
            !companyName.trim() ||
            !jdText.trim()
          }
        >
          {submitting ? "Tailoring…" : "Start tailoring"}
        </Button>
      </div>
    </section>
  );
}
