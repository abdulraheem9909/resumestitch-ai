import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, ExternalLink, Pencil, Plus, Search, SearchX, Trash2 } from "lucide-react";
import { OUTREACH_API } from "../lib/api.js";
import { apiFetch } from "../lib/apiFetch.js";
import { EmptyState } from "../components/EmptyState.jsx";
import { LoadingState } from "../components/LoadingState.jsx";
import { ContactsFieldArray } from "../components/ContactsFieldArray.jsx";
import { InfoTooltip } from "../components/approval/InfoTooltip.jsx";
import { cn } from "@/lib/utils.js";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const RESPONSE_OPTIONS = ["No reply", "Replied", "Interview", "Offer", "Rejected"];

const EMPTY_CREATE_FORM = {
  companyName: "",
  location: "",
  websiteUrl: "",
  notes: "",
  applied: false,
  response: "No reply",
  contacts: [],
};

// Response overrides applied — checked first. "No reply" (the default) is
// deliberately absent from this map so it falls through to the applied
// check below, and to no tint at all if applied is also false.
const RESPONSE_ROW_CLASSNAMES = {
  Replied: "bg-blue-50 dark:bg-blue-500/10",
  Interview: "bg-green-100 dark:bg-green-500/15",
  Offer: "bg-amber-100 dark:bg-amber-500/15",
  Rejected: "bg-red-50 dark:bg-red-500/10",
};

function rowClassName(company) {
  if (RESPONSE_ROW_CLASSNAMES[company.response]) return RESPONSE_ROW_CLASSNAMES[company.response];
  if (company.applied) return "bg-green-50 dark:bg-green-500/10";
  return "";
}

function responseBadgeClassName(response) {
  switch (response) {
    case "Replied":
      return "border-transparent bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-400";
    case "Interview":
      return "border-transparent bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-400";
    case "Offer":
      return "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400";
    case "Rejected":
      return "border-transparent bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400";
    default:
      return "border-transparent bg-secondary text-secondary-foreground";
  }
}


// websiteUrl is free text typed in at add/edit time, never fetched server-
// side (same treatment as Application.referenceUrl) — only render it as a
// clickable link when it's genuinely http(s), so a stray javascript:/data:
// scheme can never execute on click.
function safeWebsiteUrl(websiteUrl) {
  return /^https?:\/\//i.test(websiteUrl || "") ? websiteUrl : null;
}

export default function OutreachTracker() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [appliedFilter, setAppliedFilter] = useState("all");
  const [responseFilter, setResponseFilter] = useState("all");

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const fetchCompanies = useCallback(
    async (signal) => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        if (debouncedSearch) params.set("search", debouncedSearch);
        if (appliedFilter !== "all") params.set("applied", appliedFilter);
        if (responseFilter !== "all") params.set("response", responseFilter);

        const res = await apiFetch(`${OUTREACH_API}?${params}`, { signal });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Couldn't load your outreach companies.");
        setCompanies(data.companies);
      } catch (err) {
        if (err.name !== "AbortError") setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [debouncedSearch, appliedFilter, responseFilter]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchCompanies(controller.signal);
    return () => controller.abort();
  }, [fetchCompanies]);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timeout);
  }, [search]);

  function openCreate() {
    setCreateForm(EMPTY_CREATE_FORM);
    setCreateError("");
    setCreateOpen(true);
  }

  // The full company form, same field set as the detail page's edit form —
  // only the resume link is deliberately left out here, since that's a
  // detail-page-only concern (see OutreachCompanyDetail.jsx).
  async function createCompany() {
    setCreating(true);
    setCreateError("");
    try {
      const res = await apiFetch(OUTREACH_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't create this company.");

      setCreateOpen(false);
      navigate(`/outreach/${data.company._id}`);
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function deleteCompany() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await apiFetch(`${OUTREACH_API}/${deleteTarget._id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't delete this company.");

      setDeleteTarget(null);
      setCompanies((prev) => prev.filter((company) => company._id !== deleteTarget._id));
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  const hasActiveFilters = search.trim() || appliedFilter !== "all" || responseFilter !== "all";

  function clearFilters() {
    setSearch("");
    setDebouncedSearch("");
    setAppliedFilter("all");
    setResponseFilter("all");
  }

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col md:h-full">
      <div className="md:sticky md:top-0 z-10 bg-background pb-10 pt-7 md:pt-10 px-1 md:px-2">
        <p className="mb-2.5 font-mono text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Outreach Tracker
        </p>
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="font-display text-2xl font-semibold text-foreground md:text-3xl">
            Companies you've reached out to
          </h1>
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-4" /> Add company
          </Button>
        </div>
        <p className="mb-5 max-w-prose text-sm text-muted-foreground md:text-base">
          Click a company to manage its contacts, link a resume, and generate outreach emails.
        </p>

        {(companies.length > 0 || hasActiveFilters) && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="outreach-search"
                name="outreach-search"
                aria-label="Search by company name"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by company name…"
                className="pl-9"
              />
            </div>
            <Select value={appliedFilter} onValueChange={setAppliedFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Applied" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Applied or not</SelectItem>
                <SelectItem value="true">Applied</SelectItem>
                <SelectItem value="false">Not applied</SelectItem>
              </SelectContent>
            </Select>
            <Select value={responseFilter} onValueChange={setResponseFilter}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Response" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All responses</SelectItem>
                {RESPONSE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {error && (
        <Alert variant="destructive" className="mb-5">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {loading && <LoadingState message="Loading your outreach list…" />}

      {!loading && companies.length === 0 && !error && !hasActiveFilters && (
        <EmptyState
          icon={Building2}
          title="No companies yet"
          description="Add a company you've emailed directly to start tracking it here."
          action={
            <Button size="sm" onClick={openCreate}>
              <Plus className="size-4" /> Add company
            </Button>
          }
        />
      )}

      {!loading && companies.length === 0 && !error && hasActiveFilters && (
        <EmptyState
          icon={SearchX}
          title="No companies match your filters"
          description="Try adjusting or clearing your search and filters."
          action={
            <Button size="sm" variant="outline" onClick={clearFilters}>
              Clear filters
            </Button>
          }
        />
      )}

      {!loading && companies.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-card md:min-h-0 md:flex-1 md:overflow-auto">
          <table className="w-full min-w-[820px] border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-b border-border">
                <th scope="col" className="py-3 pl-4 text-left font-mono text-[11px] font-medium tracking-wide text-ink-faint uppercase">
                  Company
                </th>
                <th scope="col" className="py-3 pl-4 text-left font-mono text-[11px] font-medium tracking-wide text-ink-faint uppercase">
                  Location
                </th>
                <th scope="col" className="py-3 pl-4 text-left font-mono text-[11px] font-medium tracking-wide text-ink-faint uppercase">
                  Contacts
                </th>
                <th scope="col" className="py-3 pl-4 text-left font-mono text-[11px] font-medium tracking-wide text-ink-faint uppercase">
                  Applied
                </th>
                <th scope="col" className="py-3 pl-4 text-left font-mono text-[11px] font-medium tracking-wide text-ink-faint uppercase">
                  Response
                </th>
                <th scope="col" className="py-3 pr-4 text-right font-mono text-[11px] font-medium tracking-wide text-ink-faint uppercase">
                  Updated
                </th>
                <th scope="col" className="w-20" aria-hidden="true" />
              </tr>
            </thead>
            <tbody>
              {companies.map((company) => (
                <tr
                  key={company._id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/outreach/${company._id}`)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      navigate(`/outreach/${company._id}`);
                    }
                  }}
                  className={cn(
                    "group cursor-pointer border-b border-border transition-colors last:border-0 hover:brightness-95 focus-visible:outline-none dark:hover:brightness-110",
                    rowClassName(company)
                  )}
                >
                  <td className="py-3.5 pl-4 font-display font-semibold text-foreground">
                    <div className="flex items-center gap-1.5">
                      <span>{company.companyName}</span>
                      {safeWebsiteUrl(company.websiteUrl) && (
                        <a
                          href={safeWebsiteUrl(company.websiteUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(event) => event.stopPropagation()}
                          className="text-muted-foreground hover:text-primary"
                          aria-label={`Open ${company.companyName}'s website`}
                        >
                          <ExternalLink className="size-3.5" />
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="py-3.5 pl-4 text-foreground">
                    {company.location || <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="py-3.5 pl-4 max-w-[200px] text-foreground">
                    {(company.contacts || []).length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className="truncate">{company.contacts[0].name}</span>
                        {company.contacts.length > 1 && (
                          <Badge variant="secondary" className="shrink-0">
                            +{company.contacts.length - 1}
                          </Badge>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="py-3.5 pl-4 text-foreground">{company.applied ? "Yes" : "No"}</td>
                  <td className="py-3.5 pl-4">
                    <Badge className={responseBadgeClassName(company.response)}>{company.response}</Badge>
                  </td>
                  <td className="py-3.5 pr-4 text-right font-mono text-xs tracking-wide text-muted-foreground uppercase">
                    {company.updatedAt ? new Date(company.updatedAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="py-3.5 pr-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Edit ${company.companyName}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          navigate(`/outreach/${company._id}`);
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground hover:text-destructive"
                        aria-label={`Delete ${company.companyName}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          setDeleteTarget(company);
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={(open) => !creating && setCreateOpen(open)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add a company</DialogTitle>
            <DialogDescription>
              Track a company you emailed directly — who you talked to, and where it stands. You can link a
              resume for AI email generation from the company's own page once it's created.
            </DialogDescription>
          </DialogHeader>

          {createError && (
            <Alert variant="destructive">
              <AlertDescription>{createError}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="oc-create-companyName">Company name</Label>
            <Input
              id="oc-create-companyName"
              value={createForm.companyName}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, companyName: event.target.value }))}
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="oc-create-location">Location</Label>
            <Input
              id="oc-create-location"
              value={createForm.location}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, location: event.target.value }))}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="oc-create-websiteUrl">Website (optional, never fetched)</Label>
            <Input
              id="oc-create-websiteUrl"
              value={createForm.websiteUrl}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, websiteUrl: event.target.value }))}
              placeholder="https://…"
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="oc-create-applied"
              checked={createForm.applied}
              onCheckedChange={(checked) => setCreateForm((prev) => ({ ...prev, applied: checked === true }))}
            />
            <Label htmlFor="oc-create-applied" className="font-normal">
              Applied
            </Label>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Response</Label>
            <Select value={createForm.response} onValueChange={(value) => setCreateForm((prev) => ({ ...prev, response: value }))}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RESPONSE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ContactsFieldArray
            contacts={createForm.contacts}
            onChange={(contacts) => setCreateForm((prev) => ({ ...prev, contacts }))}
          />

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <Label htmlFor="oc-create-notes">Notes</Label>
              <InfoTooltip text="Real, specific things about this company — what they build, a personal connection, something from their site. This is the only source the AI draws on for the 'why this company' part of a generated email, so the more specific, the better the result." />
            </div>
            <Textarea
              id="oc-create-notes"
              rows={4}
              value={createForm.notes}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, notes: event.target.value }))}
            />
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button
              onClick={createCompany}
              disabled={creating || !createForm.companyName.trim() || !createForm.contacts.every((c) => c.name.trim())}
            >
              {creating ? "Adding…" : "Add company"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete "{deleteTarget?.companyName}"?</DialogTitle>
            <DialogDescription>
              This permanently removes this company and its contacts from your outreach tracker. This
              can't be undone.
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
            <Button variant="destructive" onClick={deleteCompany} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
