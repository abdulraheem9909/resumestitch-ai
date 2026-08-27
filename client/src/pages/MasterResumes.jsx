import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RESUMES_API } from "../lib/api.js";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function MasterResumes() {
  const [masterResumes, setMasterResumes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

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

  return (
    <section className="mx-auto w-full max-w-4xl">
      <p className="mb-2.5 font-mono text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Master resumes
      </p>
      <h1 className="font-display mb-3 text-3xl font-semibold text-foreground">
        Start an application
      </h1>
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
          <button
            key={resume._id}
            type="button"
            onClick={() => navigate(`/resumes/${resume._id}/apply`)}
            className="flex flex-col items-start gap-1.5 rounded-lg border border-border bg-card p-5 text-left shadow-card transition-all hover:-translate-y-0.5 hover:border-primary hover:bg-secondary/40 hover:shadow-[0_2px_4px_rgba(22,33,27,0.06),0_12px_28px_-12px_rgba(22,33,27,0.22)] focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <span className="font-display text-base font-semibold text-foreground">
              {resume.label}
            </span>
            <span className="font-mono text-[11px] tracking-wide text-ink-faint uppercase">
              Uploaded {new Date(resume.uploadedAt).toLocaleDateString()}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
