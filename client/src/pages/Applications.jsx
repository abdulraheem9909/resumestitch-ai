import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download } from "lucide-react";
import { APPLICATIONS_API } from "../lib/api.js";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function Applications() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    async function loadApplications() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(APPLICATIONS_API);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Couldn't load your applications.");
        setApplications(data.applications);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadApplications();
  }, []);

  return (
    <section className="mx-auto w-full max-w-4xl">
      <p className="mb-2.5 font-mono text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Applications
      </p>
      <div className="mb-3 flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-semibold text-foreground">
          Every approved application
        </h1>
        <a href={`${APPLICATIONS_API}/export/tracker.xlsx`}>
          <Button size="sm" variant="outline">
            <Download className="size-4" /> Export as spreadsheet
          </Button>
        </a>
      </div>
      <p className="mb-8 max-w-prose text-base text-muted-foreground">
        Once you approve an application, it shows up here — company, when you approved it, and
        the score it landed. Click into one for the full JD, tailored resume, and every insight
        alongside it.
      </p>

      {error && (
        <Alert variant="destructive" className="mb-5">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {loading && <p className="py-4 text-sm text-muted-foreground">Loading your applications…</p>}

      {!loading && applications.length === 0 && !error && (
        <p className="py-4 text-sm text-muted-foreground">No approved applications yet.</p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {applications.map((application) => (
          <button
            key={application._id}
            type="button"
            onClick={() => navigate(`/applications/${application._id}/approve`)}
            className="flex flex-col items-start gap-1.5 rounded-lg border border-border bg-card p-5 text-left shadow-card transition-all hover:-translate-y-0.5 hover:border-primary hover:bg-secondary/40 hover:shadow-[0_2px_4px_rgba(22,33,27,0.06),0_12px_28px_-12px_rgba(22,33,27,0.22)] focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <span className="font-display text-base font-semibold text-foreground">
              {application.companyName}
            </span>
            <span className="font-mono text-[11px] tracking-wide text-ink-faint uppercase">
              Approved{" "}
              {application.approvedAt ? new Date(application.approvedAt).toLocaleDateString() : "—"}
            </span>
            {application.atsScore != null && (
              <Badge variant={application.atsScore >= 70 ? "secondary" : "destructive"}>
                ATS score: {application.atsScore}
              </Badge>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}
