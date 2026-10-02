import { useCallback, useEffect, useState } from "react";
import { Building2, ExternalLink, Mail, Pencil, Plus, Search, SearchX, Trash2 } from "lucide-react";
import { OUTREACH_API, RESUMES_API } from "../lib/api.js";
import { apiFetch } from "../lib/apiFetch.js";
import { EmptyState } from "../components/EmptyState.jsx";
import { LoadingState } from "../components/LoadingState.jsx";
import { ContactsFieldArray } from "../components/ContactsFieldArray.jsx";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const RESPONSE_OPTIONS = ["No reply", "Replied", "Interview", "Offer", "Rejected"];

const EMPTY_FORM = {
  companyName: "",
  location: "",
  websiteUrl: "",
  notes: "",
  applied: false,
  response: "No reply",
  contacts: [],
  masterResumeId: "",
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

function contactsSummary(contacts) {
  if (!contacts || contacts.length === 0) return null;
  return contacts.map((contact) => (contact.role ? `${contact.name} (${contact.role})` : contact.name)).join(", ");
}

// websiteUrl is free text typed in at add/edit time, never fetched server-
// side (same treatment as Application.referenceUrl) — only render it as a
// clickable link when it's genuinely http(s), so a stray javascript:/data:
// scheme can never execute on click.
function safeWebsiteUrl(websiteUrl) {
  return /^https?:\/\//i.test(websiteUrl || "") ? websiteUrl : null;
}

export default function OutreachTracker() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [appliedFilter, setAppliedFilter] = useState("all");
  const [responseFilter, setResponseFilter] = useState("all");

  const [formOpen, setFormOpen] = useState(false);
  const [formTarget, setFormTarget] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const [masterResumes, setMasterResumes] = useState([]);
  const [activeTab, setActiveTab] = useState("companies");
  const [selectedContactKeys, setSelectedContactKeys] = useState(new Set());
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [generateGoal, setGenerateGoal] = useState("speculative");
  const [referralRole, setReferralRole] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const [drafts, setDrafts] = useState([]); // [{ key, companyName, contactName, subject, body, copied, error }]

  const allContacts = companies.flatMap((company) =>
    (company.contacts || []).map((contact) => ({
      key: `${company._id}:${contact._id}`,
      companyId: company._id,
      companyName: company.companyName,
      contactId: contact._id,
      name: contact.name,
      role: contact.role,
      category: contact.category || "Other",
    }))
  );

  function toggleContact(key) {
    setSelectedContactKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // Sequential, not Promise.all — deliberate: avoids bursting several LLM
  // calls at once for what's meant to be a manual, reviewed-as-you-go
  // action, and means one failing contact doesn't abort the rest.
  async function generateEmails() {
    if (generateGoal === "referral" && !referralRole.trim()) {
      setGenerateError("Enter which role this referral is for.");
      return;
    }
    setGenerating(true);
    setGenerateError("");

    const targets = allContacts.filter((contact) => selectedContactKeys.has(contact.key));
    const results = [];
    for (const contact of targets) {
      try {
        const res = await apiFetch(`${OUTREACH_API}/${contact.companyId}/contacts/${contact.contactId}/generate-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ goal: generateGoal, referralRole: referralRole.trim() }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Couldn't generate this email.");
        results.push({
          key: contact.key,
          companyName: contact.companyName,
          contactName: contact.name,
          subject: data.subject,
          body: data.body,
          copied: false,
          error: "",
        });
      } catch (err) {
        results.push({
          key: contact.key,
          companyName: contact.companyName,
          contactName: contact.name,
          subject: "",
          body: "",
          copied: false,
          error: err.message,
        });
      }
    }

    setDrafts(results);
    setGenerating(false);
    setGenerateDialogOpen(false);
  }

  function updateDraft(key, field, value) {
    setDrafts((prev) => prev.map((draft) => (draft.key === key ? { ...draft, [field]: value, copied: false } : draft)));
  }

  async function copyDraft(key) {
    const draft = drafts.find((d) => d.key === key);
    if (!draft) return;
    await navigator.clipboard.writeText(`Subject: ${draft.subject}\n\n${draft.body}`);
    setDrafts((prev) => prev.map((d) => (d.key === key ? { ...d, copied: true } : d)));
  }

  useEffect(() => {
    async function loadMasterResumes() {
      try {
        const res = await apiFetch(RESUMES_API);
        const data = await res.json();
        if (res.ok) setMasterResumes(data.masterResumes || []);
      } catch {
        // Non-fatal — the resume-link dropdown just won't have options.
      }
    }
    loadMasterResumes();
  }, []);

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
    setFormTarget(null);
    setForm(EMPTY_FORM);
    setSaveError("");
    setFormOpen(true);
  }

  function openEdit(company) {
    setFormTarget(company);
    setForm({
      companyName: company.companyName,
      location: company.location || "",
      websiteUrl: company.websiteUrl || "",
      notes: company.notes || "",
      applied: company.applied,
      response: company.response,
      masterResumeId: company.masterResumeId || "",
      contacts: (company.contacts || []).map((contact) => ({
        _id: contact._id,
        name: contact.name,
        role: contact.role || "",
        email: contact.email || "",
        category: contact.category || "Other",
        categoryTouched: true,
      })),
    });
    setSaveError("");
    setFormOpen(true);
  }

  async function saveCompany() {
    setSaving(true);
    setSaveError("");
    try {
      const url = formTarget ? `${OUTREACH_API}/${formTarget._id}` : OUTREACH_API;
      const method = formTarget ? "PATCH" : "POST";
      const res = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't save this company.");

      setFormOpen(false);
      fetchCompanies();
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
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

  const canSave = form.companyName.trim() && form.contacts.every((contact) => contact.name.trim());
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
          Every company you've emailed directly — who you talked to, whether you applied, and what
          they said back.
        </p>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-5">
          <TabsList>
            <TabsTrigger value="companies">Companies</TabsTrigger>
            <TabsTrigger value="contacts">Contacts ({allContacts.length})</TabsTrigger>
          </TabsList>
        </Tabs>

        {activeTab === "companies" && (companies.length > 0 || hasActiveFilters) && (
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

      {activeTab === "companies" && error && (
        <Alert variant="destructive" className="mb-5">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {activeTab === "companies" && loading && <LoadingState message="Loading your outreach list…" />}

      {activeTab === "companies" && !loading && companies.length === 0 && !error && !hasActiveFilters && (
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

      {activeTab === "companies" && !loading && companies.length === 0 && !error && hasActiveFilters && (
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

      {activeTab === "companies" && !loading && companies.length > 0 && (
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
                  onClick={() => openEdit(company)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openEdit(company);
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
                  <td className="py-3.5 pl-4 max-w-[240px] text-foreground">
                    {contactsSummary(company.contacts) ? (
                      <span className="line-clamp-2">{contactsSummary(company.contacts)}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
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
                        onClick={(event) => {
                          event.stopPropagation();
                          openEdit(company);
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground hover:text-destructive"
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

      {activeTab === "contacts" && allContacts.length > 0 && (
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {selectedContactKeys.size} selected
          </p>
          <Button size="sm" disabled={selectedContactKeys.size === 0} onClick={() => setGenerateDialogOpen(true)}>
            <Mail className="size-4" /> Generate emails
          </Button>
        </div>
      )}

      {activeTab === "contacts" && (
        <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-card">
          {allContacts.length === 0 ? (
            <EmptyState
              icon={Mail}
              title="No contacts yet"
              description="Add a contact to one of your companies first, then come back here to generate outreach emails."
            />
          ) : (
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-card">
                <tr className="border-b border-border">
                  <th scope="col" className="w-10 py-3 pl-4" aria-hidden="true" />
                  <th scope="col" className="py-3 pl-2 text-left font-mono text-[11px] font-medium tracking-wide text-ink-faint uppercase">Name</th>
                  <th scope="col" className="py-3 pl-4 text-left font-mono text-[11px] font-medium tracking-wide text-ink-faint uppercase">Role</th>
                  <th scope="col" className="py-3 pl-4 text-left font-mono text-[11px] font-medium tracking-wide text-ink-faint uppercase">Category</th>
                  <th scope="col" className="py-3 pl-4 text-left font-mono text-[11px] font-medium tracking-wide text-ink-faint uppercase">Company</th>
                </tr>
              </thead>
              <tbody>
                {allContacts.map((contact) => (
                  <tr key={contact.key} className="border-b border-border last:border-0">
                    <td className="py-3 pl-4">
                      <Checkbox
                        checked={selectedContactKeys.has(contact.key)}
                        onCheckedChange={() => toggleContact(contact.key)}
                        aria-label={`Select ${contact.name}`}
                      />
                    </td>
                    <td className="py-3 pl-2 font-medium text-foreground">{contact.name}</td>
                    <td className="py-3 pl-4 text-foreground">{contact.role || <span className="text-muted-foreground">—</span>}</td>
                    <td className="py-3 pl-4 text-foreground">{contact.category}</td>
                    <td className="py-3 pl-4 text-foreground">{contact.companyName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={(open) => !saving && setFormOpen(open)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{formTarget ? `Edit ${formTarget.companyName}` : "Add a company"}</DialogTitle>
            <DialogDescription>
              Track a company you emailed directly — who you talked to, and where it stands.
            </DialogDescription>
          </DialogHeader>

          {saveError && (
            <Alert variant="destructive">
              <AlertDescription>{saveError}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="oc-companyName">Company name</Label>
            <Input
              id="oc-companyName"
              value={form.companyName}
              onChange={(event) => setForm((prev) => ({ ...prev, companyName: event.target.value }))}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="oc-location">Location</Label>
            <Input
              id="oc-location"
              value={form.location}
              onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="oc-websiteUrl">Website (optional, never fetched)</Label>
            <Input
              id="oc-websiteUrl"
              value={form.websiteUrl}
              onChange={(event) => setForm((prev) => ({ ...prev, websiteUrl: event.target.value }))}
              placeholder="https://…"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Resume (optional, used for AI email generation)</Label>
            <Select
              value={form.masterResumeId || "none"}
              onValueChange={(value) => setForm((prev) => ({ ...prev, masterResumeId: value === "none" ? "" : value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="No resume linked" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No resume linked</SelectItem>
                {masterResumes.map((resume) => (
                  <SelectItem key={resume._id} value={resume._id}>
                    {resume.personalInfo?.fullName || resume.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="oc-applied"
              checked={form.applied}
              onCheckedChange={(checked) => setForm((prev) => ({ ...prev, applied: checked === true }))}
            />
            <Label htmlFor="oc-applied" className="font-normal">
              Applied
            </Label>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Response</Label>
            <Select value={form.response} onValueChange={(value) => setForm((prev) => ({ ...prev, response: value }))}>
              <SelectTrigger>
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
            contacts={form.contacts}
            onChange={(contacts) => setForm((prev) => ({ ...prev, contacts }))}
          />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="oc-notes">Notes</Label>
            <Textarea
              id="oc-notes"
              rows={4}
              value={form.notes}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
            />
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveCompany} disabled={saving || !canSave}>
              {saving ? "Saving…" : formTarget ? "Save changes" : "Add company"}
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

      <Dialog open={generateDialogOpen} onOpenChange={(open) => !generating && setGenerateDialogOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate {selectedContactKeys.size} email{selectedContactKeys.size === 1 ? "" : "s"}</DialogTitle>
            <DialogDescription>
              Drafts only — nothing is sent. You'll review and copy each one yourself.
            </DialogDescription>
          </DialogHeader>

          {generateError && (
            <Alert variant="destructive">
              <AlertDescription>{generateError}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-1.5">
            <Label>Goal</Label>
            <Select value={generateGoal} onValueChange={setGenerateGoal}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="speculative">Speculative — ask about a role, or to be kept in mind</SelectItem>
                <SelectItem value="referral">Referral — ask about a role already applied to elsewhere</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {generateGoal === "referral" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="referral-role">Which role</Label>
              <Input
                id="referral-role"
                value={referralRole}
                onChange={(event) => setReferralRole(event.target.value)}
                placeholder="e.g. the Backend Engineer position"
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setGenerateDialogOpen(false)} disabled={generating}>
              Cancel
            </Button>
            <Button onClick={generateEmails} disabled={generating}>
              {generating ? "Generating…" : "Generate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {drafts.length > 0 && (
        <div className="mt-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-foreground">Generated drafts</h2>
            <Button variant="ghost" size="sm" onClick={() => setDrafts([])}>
              Clear
            </Button>
          </div>
          {drafts.map((draft) => (
            <div key={draft.key} className="rounded-lg border border-border bg-card p-4 shadow-card">
              <p className="mb-2 text-sm font-medium text-foreground">
                {draft.contactName} <span className="text-muted-foreground">· {draft.companyName}</span>
              </p>
              {draft.error ? (
                <Alert variant="destructive">
                  <AlertDescription>{draft.error}</AlertDescription>
                </Alert>
              ) : (
                <div className="flex flex-col gap-2">
                  <Input
                    value={draft.subject}
                    onChange={(event) => updateDraft(draft.key, "subject", event.target.value)}
                    aria-label={`Subject for ${draft.contactName}`}
                  />
                  <Textarea
                    rows={6}
                    value={draft.body}
                    onChange={(event) => updateDraft(draft.key, "body", event.target.value)}
                    aria-label={`Body for ${draft.contactName}`}
                  />
                  <Button size="sm" variant="outline" className="w-fit" onClick={() => copyDraft(draft.key)}>
                    {draft.copied ? "Copied!" : "Copy"}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
