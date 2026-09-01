import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ChevronsUpDown,
  Download,
  FileText,
  Inbox,
  Plus,
  Search,
  SearchX,
  Trash2,
} from "lucide-react";
import { APPLICATIONS_API, RESUMES_API } from "../lib/api.js";
import { EmptyState } from "../components/EmptyState.jsx";
import { LoadingState } from "../components/LoadingState.jsx";
import { cn } from "@/lib/utils.js";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const COLUMNS = [
  { key: "companyName", label: "Company", align: "left" },
  { key: "jobTitle", label: "Job title", align: "left" },
  { key: "status", label: "Status", align: "left" },
  { key: "updatedAt", label: "Updated", align: "right" },
  { key: "atsScore", label: "ATS score", align: "right" },
];

const STATUS_LABELS = {
  approved: "Approved",
  pending_approval: "In review",
  role_mismatch: "Role mismatch",
  in_progress: "Processing",
};

function statusLabel(status) {
  return STATUS_LABELS[status] || status;
}

function statusBadgeClassName(status) {
  if (status === "approved") {
    return "border-transparent bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-400";
  }
  if (status === "role_mismatch") {
    return "border-transparent bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400";
  }
  // pending_approval / in_progress / anything else still in flight
  return "border-transparent bg-yellow-100 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-400";
}

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

// Whichever is current: the human re-check's score if one was ever run before
// approval, otherwise the original AI-time score — same "current" rule the
// Approval page itself uses, so this table never shows a stale number.
function currentAtsScore(application) {
  return application.humanRecheckAtsScore ?? application.atsScore;
}

export default function Applications() {
  const [applications, setApplications] = useState([]);
  const [masterResumes, setMasterResumes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sort, setSort] = useState({ key: "updatedAt", direction: "desc" });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [atsFilter, setAtsFilter] = useState("all");
  const [coverLetterFilter, setCoverLetterFilter] = useState("all");
  const [resumeFilter, setResumeFilter] = useState("all");

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    async function loadApplications() {
      setLoading(true);
      setError("");
      try {
        const [applicationsRes, resumesRes] = await Promise.all([
          fetch(APPLICATIONS_API),
          fetch(RESUMES_API),
        ]);
        const data = await applicationsRes.json();
        if (!applicationsRes.ok) throw new Error(data.error || "Couldn't load your applications.");
        const resumesData = await resumesRes.json();
        setApplications(data.applications);
        // Non-fatal if this one fails — the resume filter just won't have
        // labels to offer, everything else on the page still works.
        if (resumesRes.ok) setMasterResumes(resumesData.masterResumes || []);
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

  const filteredApplications = useMemo(() => {
    const query = search.trim().toLowerCase();
    return applications.filter((application) => {
      if (query) {
        const haystack = `${application.companyName} ${application.jobTitle || ""}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (statusFilter !== "all" && application.status !== statusFilter) return false;
      if (atsFilter !== "all" && scoreTier(currentAtsScore(application)) !== atsFilter) return false;
      if (coverLetterFilter === "yes" && !application.coverLetterRequested) return false;
      if (coverLetterFilter === "no" && application.coverLetterRequested) return false;
      if (resumeFilter !== "all" && application.masterResumeId !== resumeFilter) return false;
      return true;
    });
  }, [applications, search, statusFilter, atsFilter, coverLetterFilter, resumeFilter]);

  const sortedApplications = useMemo(() => {
    const factor = sort.direction === "asc" ? 1 : -1;
    return [...filteredApplications].sort((a, b) => {
      if (sort.key === "companyName") {
        return a.companyName.localeCompare(b.companyName) * factor;
      }
      if (sort.key === "jobTitle") {
        return (a.jobTitle || "").localeCompare(b.jobTitle || "") * factor;
      }
      if (sort.key === "status") {
        return statusLabel(a.status).localeCompare(statusLabel(b.status)) * factor;
      }
      if (sort.key === "atsScore") {
        return ((currentAtsScore(a) ?? -1) - (currentAtsScore(b) ?? -1)) * factor;
      }
      return (new Date(a.updatedAt ?? 0) - new Date(b.updatedAt ?? 0)) * factor;
    });
  }, [filteredApplications, sort]);

  async function deleteApplication() {
    if (!deleteTarget) return;

    setDeleting(true);
    setDeleteError("");
    try {
      const res = await fetch(`${APPLICATIONS_API}/${deleteTarget._id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't delete this application.");

      setApplications((prev) => prev.filter((application) => application._id !== deleteTarget._id));
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  const hasActiveFilters =
    search.trim() ||
    statusFilter !== "all" ||
    atsFilter !== "all" ||
    coverLetterFilter !== "all" ||
    resumeFilter !== "all";

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setAtsFilter("all");
    setCoverLetterFilter("all");
    setResumeFilter("all");
  }

  return (
    <section className="mx-auto w-full max-w-5xl">
      <div className="sticky top-0 z-10 bg-background pb-10 pt-7 md:pt-10 px-1 md:px-2">
        <p className="mb-2.5 font-mono text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Applications
        </p>
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="font-display text-2xl font-semibold text-foreground md:text-3xl">
            Every application
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
        <p className="mb-5 max-w-prose text-sm text-muted-foreground md:text-base">
          Every application you've started shows up here, whatever state it's in — company,
          status, and the score it landed. Click a row to pick up right where you left off.
        </p>

        {applications.length > 0 && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="applications-search"
                name="applications-search"
                aria-label="Search applications by company or job title"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by company or job title…"
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="pending_approval">In review</SelectItem>
                <SelectItem value="role_mismatch">Role mismatch</SelectItem>
              </SelectContent>
            </Select>
            <Select value={atsFilter} onValueChange={setAtsFilter}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="ATS score" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All scores</SelectItem>
                <SelectItem value="strong">Strong (≥70)</SelectItem>
                <SelectItem value="weak">Weak (&lt;70)</SelectItem>
                <SelectItem value="unknown">Unscored</SelectItem>
              </SelectContent>
            </Select>
            <Select value={coverLetterFilter} onValueChange={setCoverLetterFilter}>
              <SelectTrigger className="w-full sm:w-52">
                <SelectValue placeholder="Cover letter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">With or without cover letter</SelectItem>
                <SelectItem value="yes">With cover letter</SelectItem>
                <SelectItem value="no">Without cover letter</SelectItem>
              </SelectContent>
            </Select>
            {masterResumes.length > 1 && (
              <Select value={resumeFilter} onValueChange={setResumeFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Resume" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All resumes</SelectItem>
                  {masterResumes.map((resume) => (
                    <SelectItem key={resume._id} value={resume._id}>
                      {resume.personalInfo?.fullName || resume.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}
      </div>

      {error && (
        <Alert variant="destructive" className="mb-5">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {loading && <LoadingState message="Loading your applications…" />}

      {!loading && applications.length === 0 && !error && (
        <EmptyState
          icon={Inbox}
          title="No applications yet"
          description="Start your first application to tailor a resume against a job description."
          action={
            <Button size="sm" onClick={() => navigate("/apply")}>
              <Plus className="size-4" /> Start application
            </Button>
          }
        />
      )}

      {!loading && applications.length > 0 && sortedApplications.length === 0 && (
        <EmptyState
          icon={SearchX}
          title="No applications match your filters"
          description="Try adjusting or clearing your search and filters."
          action={
            <Button size="sm" variant="outline" onClick={clearFilters}>
              Clear filters
            </Button>
          }
        />
      )}

      {!loading && sortedApplications.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-card">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border">
                {COLUMNS.map((column) => (
                  <SortableHeader key={column.key} column={column} sort={sort} onSort={handleSort} />
                ))}
                <th scope="col" className="w-20" aria-hidden="true" />
              </tr>
            </thead>
            <tbody>
              {sortedApplications.map((application) => {
                const score = currentAtsScore(application);
                const tier = scoreTier(score);
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
                    <td className="py-3.5 pl-4 text-foreground">
                      {application.jobTitle || <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="py-3.5 pl-4">
                      <Badge className={statusBadgeClassName(application.status)}>
                        {statusLabel(application.status)}
                      </Badge>
                    </td>
                    <td className="py-3.5 pr-4 text-right font-mono text-xs tracking-wide text-muted-foreground uppercase">
                      {application.updatedAt ? new Date(application.updatedAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-3.5 pr-4 text-right">
                      {score != null ? (
                        <Badge variant={tier === "strong" ? "secondary" : "destructive"}>
                          {score}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-3.5 pr-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={(event) => {
                            event.stopPropagation();
                            setDeleteTarget(application);
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                        <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Delete "{deleteTarget?.companyName}
              {deleteTarget?.jobTitle ? ` — ${deleteTarget.jobTitle}` : ""}"?
            </DialogTitle>
            <DialogDescription>
              This permanently deletes this application — the JD, tailored resume, cover letter,
              and scoring history. This can't be undone.
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
            <Button variant="destructive" onClick={deleteApplication} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
