import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronRight, ChevronUp, ChevronsUpDown, Download, FileText, Plus } from "lucide-react";
import { APPLICATIONS_API } from "../lib/api.js";
import { cn } from "@/lib/utils.js";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const COLUMNS = [
  { key: "companyName", label: "Company", align: "left" },
  { key: "approvedAt", label: "Approved", align: "right" },
  { key: "atsScore", label: "ATS score", align: "right" },
];

function SortableHeader({ column, sort, onSort }) {
  const active = sort.key === column.key;
  return (
    <th
      scope="col"
      className={cn(
        "py-3 font-mono text-[11px] font-medium tracking-wide text-ink-faint uppercase select-none",
        column.align === "right" ? "pr-4 text-right" : "pl-4 text-left"
      )}
    >
      <button
        type="button"
        onClick={() => onSort(column.key)}
        className={cn(
          "inline-flex items-center gap-1 transition-colors hover:text-foreground",
          column.align === "right" && "flex-row-reverse"
        )}
      >
        {column.label}
        {active ? (
          sort.direction === "asc" ? (
            <ChevronUp className="size-3" />
          ) : (
            <ChevronDown className="size-3" />
          )
        ) : (
          <ChevronsUpDown className="size-3 opacity-40" />
        )}
      </button>
    </th>
  );
}

function scoreTier(atsScore) {
  if (atsScore == null) return "unknown";
  return atsScore >= 70 ? "strong" : "weak";
}

export default function Applications() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sort, setSort] = useState({ key: "approvedAt", direction: "desc" });
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

  function handleSort(key) {
    setSort((prev) =>
      prev.key === key ? { key, direction: prev.direction === "asc" ? "desc" : "asc" } : { key, direction: "asc" }
    );
  }

  const sortedApplications = useMemo(() => {
    const factor = sort.direction === "asc" ? 1 : -1;
    return [...applications].sort((a, b) => {
      if (sort.key === "companyName") {
        return a.companyName.localeCompare(b.companyName) * factor;
      }
      if (sort.key === "atsScore") {
        return ((a.atsScore ?? -1) - (b.atsScore ?? -1)) * factor;
      }
      return (new Date(a.approvedAt ?? 0) - new Date(b.approvedAt ?? 0)) * factor;
    });
  }, [applications, sort]);

  return (
    <section className="mx-auto w-full max-w-5xl">
      <div className="sticky top-0 z-10 bg-background pb-10 pt-7 md:pt-10 px-1 md:px-2">
        <p className="mb-2.5 font-mono text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Applications
        </p>
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="font-display text-2xl font-semibold text-foreground md:text-3xl">
            Every approved application
          </h1>
          <div className="flex flex-wrap gap-2">
            <a href={`${APPLICATIONS_API}/export/tracker.xlsx`}>
              <Button size="sm" variant="outline">
                <Download className="size-4" /> Export as spreadsheet
              </Button>
            </a>
            <Button size="sm" onClick={() => navigate("/apply")}>
              <Plus className="size-4" /> Start application
            </Button>
          </div>
        </div>
        <p className="max-w-prose text-sm text-muted-foreground md:text-base">
          Once you approve an application, it shows up here — company, when you approved it, and
          the score it landed. Click a row for the full JD, tailored resume, and every insight
          alongside it.
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-5">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {loading && <p className="py-4 text-sm text-muted-foreground">Loading your applications…</p>}

      {!loading && applications.length === 0 && !error && (
        <p className="py-4 text-sm text-muted-foreground">No approved applications yet.</p>
      )}

      {!loading && applications.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-card">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border">
                {COLUMNS.map((column) => (
                  <SortableHeader key={column.key} column={column} sort={sort} onSort={handleSort} />
                ))}
                <th scope="col" className="w-10" aria-hidden="true" />
              </tr>
            </thead>
            <tbody>
              {sortedApplications.map((application) => {
                const tier = scoreTier(application.atsScore);
                return (
                  <tr
                    key={application._id}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/applications/${application._id}/approve`)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        navigate(`/applications/${application._id}/approve`);
                      }
                    }}
                    className="group cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-secondary/40 focus-visible:bg-secondary/40 focus-visible:outline-none"
                  >
                    <td className="py-3.5 pl-4">
                      <div className="flex items-center gap-2">
                        <span className="font-display font-semibold text-foreground">
                          {application.companyName}
                        </span>
                        {application.coverLetterRequested && (
                          <FileText className="size-3.5 shrink-0 text-muted-foreground" aria-label="Cover letter generated" />
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 pr-4 text-right font-mono text-xs tracking-wide text-muted-foreground uppercase">
                      {application.approvedAt ? new Date(application.approvedAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-3.5 pr-4 text-right">
                      {application.atsScore != null ? (
                        <Badge variant={tier === "strong" ? "secondary" : "destructive"}>
                          {application.atsScore}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-3.5 pr-4 text-right">
                      <ChevronRight className="ml-auto size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
