import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { APPLICATIONS_API, RESUMES_API } from "../lib/api.js";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function JdSubmission() {
  const { resumeId } = useParams();
  const navigate = useNavigate();

  const [resumeLabel, setResumeLabel] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [jdText, setJdText] = useState("");
  const [referenceUrl, setReferenceUrl] = useState("");
  const [coverLetterRequested, setCoverLetterRequested] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadResumeLabel() {
      try {
        const res = await fetch(RESUMES_API);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Couldn't load resumes.");
        const resume = data.masterResumes?.find((r) => r._id === resumeId);
        setResumeLabel(resume?.label || "");
      } catch {
        // non-fatal — the label is a nicety, submission still works without it
      }
    }
    loadResumeLabel();
  }, [resumeId]);

  async function submit() {
    if (!companyName.trim() || !jdText.trim()) return;

    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(APPLICATIONS_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          masterResumeId: resumeId,
          companyName,
          jdText,
          referenceUrl: referenceUrl || undefined,
          coverLetterRequested,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't start tailoring for this job description.");

      navigate(`/applications/${data.application._id}/approve`);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-2xl">
      <p className="mb-2.5 font-mono text-xs font-medium tracking-wide text-muted-foreground uppercase">
        New application{resumeLabel ? ` · ${resumeLabel}` : ""}
      </p>
      <h1 className="font-display mb-3 text-3xl font-semibold text-foreground">Paste a job description</h1>
      <p className="mb-8 max-w-prose text-base text-muted-foreground">
        Paste the job's text as-is — nothing is fetched from a URL. We'll extract what it's asking
        for, check it against this resume, and tailor a draft for you to review.
      </p>

      {error && (
        <Alert variant="destructive" className="mb-5">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-5">
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
          <Label htmlFor="jd-reference">Reference link (optional, never fetched)</Label>
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
          disabled={submitting || !companyName.trim() || !jdText.trim()}
        >
          {submitting ? "Tailoring…" : "Start tailoring"}
        </Button>
      </div>
    </section>
  );
}
