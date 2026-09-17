import { useCallback, useEffect, useState } from "react";
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
import { apiFetch } from "../lib/apiFetch.js";
import { downloadFile } from "../lib/downloadFile.js";
import { DownloadOverlay } from "../components/DownloadOverlay.jsx";
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

const PAGE_SIZE = 20;

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
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasApprovedApplications, setHasApprovedApplications] = useState(false);
  const [masterResumes, setMasterResumes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sort, setSort] = useState({ key: "updatedAt", direction: "desc" });
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [atsFilter, setAtsFilter] = useState("all");
  const [coverLetterFilter, setCoverLetterFilter] = useState("all");
  const [resumeFilter, setResumeFilter] = useState("all");

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const [downloadingTracker, setDownloadingTracker] = useState(false);

  const navigate = useNavigate();

  // The master-resumes list is only ever used to populate the resume-filter
  // dropdown's options — fetched once, independent of the paginated
  // applications query below.
  useEffect(() => {
    async function loadMasterResumes() {
      try {
        const res = await apiFetch(RESUMES_API);
        const data = await res.json();
        // Non-fatal if this fails — the resume filter just won't have
        // labels to offer, everything else on the page still works.
        if (res.ok) setMasterResumes(data.masterResumes || []);
      } catch {
        // Same non-fatal reasoning as above.
      }
    }
    loadMasterResumes();
  }, []);

  const fetchApplications = useCallback(
    async (signal) => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(PAGE_SIZE),
          sortKey: sort.key,
          sortDir: sort.direction,
        });
        if (debouncedSearch) params.set("search", debouncedSearch);
        if (statusFilter !== "all") params.set("status", statusFilter);
        if (atsFilter !== "all") params.set("ats", atsFilter);
        if (coverLetterFilter !== "all") params.set("coverLetter", coverLetterFilter);
        if (resumeFilter !== "all") params.set("resume", resumeFilter);

        const res = await apiFetch(`${APPLICATIONS_API}?${params}`, { signal });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Couldn't load your applications.");
        setApplications(data.applications);
        setTotal(data.total);
        setHasApprovedApplications(data.hasApprovedApplications);
      } catch (err) {
        if (err.name !== "AbortError") setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [page, sort, debouncedSearch, statusFilter, atsFilter, coverLetterFilter, resumeFilter]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchApplications(controller.signal);
    return () => controller.abort();
  }, [fetchApplications]);

  // Debounced separately from the other filters so every keystroke doesn't
  // fire its own request — settles 300ms after typing stops.
  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  function handleSort(key) {
    setSort((prev) =>
      prev.key === key ? { key, direction: prev.direction === "asc" ? "desc" : "asc" } : { key, direction: "asc" }
    );
    setPage(1);
  }

  async function deleteApplication() {
    if (!deleteTarget) return;

    setDeleting(true);
    setDeleteError("");
    try {
      const res = await apiFetch(`${APPLICATIONS_API}/${deleteTarget._id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't delete this application.");

      setDeleteTarget(null);
      // Deleting the last row on a page beyond the first falls back a page;
      // otherwise just re-fetch the same page fresh.
      if (applications.length === 1 && page > 1) {
        setPage((prev) => prev - 1);
      } else {
        fetchApplications();
      }
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  // The tracker route rebuilds the spreadsheet from every approved
  // application fresh on each request, so this can take a moment on a slow
  // host — the overlay/disabled button are the only sign a click landed.
  async function handleExportTracker() {
    setDownloadingTracker(true);
    setError("");
    try {
      await downloadFile(`${APPLICATIONS_API}/export/tracker.xlsx`, "tracker.xlsx");
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloadingTracker(false);
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
    setDebouncedSearch("");
    setStatusFilter("all");
    setAtsFilter("all");
    setCoverLetterFilter("all");
    setResumeFilter("all");
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col md:h-full">
      {downloadingTracker && <DownloadOverlay message="Building your spreadsheet…" />}
      <div className="sticky top-0 z-10 bg-background pb-10 pt-7 md:pt-10 px-1 md:px-2">
        <p className="mb-2.5 font-mono text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Applications
        </p>
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="font-display text-2xl font-semibold text-foreground md:text-3xl">
            Every application
          </h1>
          <div className="flex flex-wrap gap-2">
            {hasApprovedApplications ? (
              <Button size="sm" variant="outline" disabled={downloadingTracker} onClick={handleExportTracker}>
                <Download className="size-4" /> Export as spreadsheet
              </Button>
            ) : (
              <Button size="sm" variant="outline" disabled title="No approved applications to export yet">
                <Download className="size-4" /> Export as spreadsheet
              </Button>
            )}
            <Button size="sm" onClick={() => navigate("/apply")}>
              <Plus className="size-4" /> Start application
            </Button>
          </div>
        </div>
        <p className="mb-5 max-w-prose text-sm text-muted-foreground md:text-base">
          Every application you've started shows up here, whatever state it's in — company,
          status, and the score it landed. Click a row to pick up right where you left off.
        </p>

        {(total > 0 || hasActiveFilters) && (
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
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value);
                setPage(1);
              }}
            >
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
            <Select
              value={atsFilter}
              onValueChange={(value) => {
                setAtsFilter(value);
                setPage(1);
              }}
            >
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
            <Select
              value={coverLetterFilter}
              onValueChange={(value) => {
                setCoverLetterFilter(value);
                setPage(1);
              }}
            >
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
              <Select
                value={resumeFilter}
                onValueChange={(value) => {
                  setResumeFilter(value);
                  setPage(1);
                }}
              >
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

      {!loading && total === 0 && !error && !hasActiveFilters && (
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

      {!loading && total === 0 && !error && hasActiveFilters && (
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

      {!loading && applications.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-card md:min-h-0 md:flex-1 md:overflow-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-b border-border">
                {COLUMNS.map((column) => (
                  <SortableHeader key={column.key} column={column} sort={sort} onSort={handleSort} />
                ))}
                <th scope="col" className="w-20" aria-hidden="true" />
              </tr>
            </thead>
            <tbody>
              {applications.map((application) => {
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

      {!loading && total > 0 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((prev) => prev - 1)}>
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((prev) => prev + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}>
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
