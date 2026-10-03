import { Fragment, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Check, ChevronDown, Copy, ExternalLink, Mail, Pencil, Trash2 } from "lucide-react";
import { OUTREACH_API, RESUMES_API } from "../lib/api.js";
import { apiFetch } from "../lib/apiFetch.js";
import Breadcrumbs from "../components/Breadcrumbs.jsx";
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

const RESPONSE_OPTIONS = ["No reply", "Replied", "Interview", "Offer", "Rejected"];

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

// Same safety rule as the list page — only ever render as a real link when
// it's genuinely http(s).
function safeWebsiteUrl(websiteUrl) {
  return /^https?:\/\//i.test(websiteUrl || "") ? websiteUrl : null;
}

function editFormFromCompany(company) {
  return {
    companyName: company.companyName,
    location: company.location || "",
    websiteUrl: company.websiteUrl || "",
    notes: company.notes || "",
    applied: company.applied,
    response: company.response,
    contacts: (company.contacts || []).map((contact) => ({
      _id: contact._id,
      name: contact.name,
      role: contact.role || "",
      email: contact.email || "",
      category: contact.category || "Other",
      categoryTouched: true,
      // Carried through untouched so a save of an unrelated field (e.g.
      // just toggling Applied) doesn't wipe this contact's generated
      // draft — normalizeOutreachCompanyPayload preserves it server-side
      // only when the client actually echoes it back.
      lastGeneratedEmail: contact.lastGeneratedEmail,
    })),
  };
}

// Drafts persisted server-side are the source of truth on page load. Only
// called once per company-id navigation (see the effect below) — not on
// every later company update — so an in-progress, not-yet-copied edit to a
// draft's subject/body is never silently clobbered by an unrelated save.
function draftsFromCompany(company) {
  return (company.contacts || [])
    .filter((contact) => contact.lastGeneratedEmail?.subject || contact.lastGeneratedEmail?.body)
    .map((contact) => ({
      contactId: contact._id,
      contactName: contact.name,
      subject: contact.lastGeneratedEmail.subject || "",
      body: contact.lastGeneratedEmail.body || "",
      copiedSubject: false,
      copiedBody: false,
      error: "",
    }));
}

export default function OutreachCompanyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [masterResumes, setMasterResumes] = useState([]);
  const [savingResume, setSavingResume] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const [selectedContactIds, setSelectedContactIds] = useState(new Set());
  const [generateGoal, setGenerateGoal] = useState("speculative");
  const [referralRole, setReferralRole] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const [drafts, setDrafts] = useState([]); // [{ contactId, contactName, subject, body, copied, error }]
  const [expandedDraftIds, setExpandedDraftIds] = useState(new Set());

  useEffect(() => {
    async function loadCompany() {
      setLoading(true);
      setError("");
      try {
        const res = await apiFetch(`${OUTREACH_API}/${id}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Couldn't load this company.");
        setCompany(data.company);
        setDrafts(draftsFromCompany(data.company));
        setExpandedDraftIds(new Set());
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadCompany();
  }, [id]);

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

  // Every company save strips and re-creates contact _ids server-side, so a
  // selection built from a stale _id can silently stop resolving to any
  // live contact. Prune whenever the company (and therefore its contacts)
  // changes. Only updates state when the set actually shrinks, so this
  // can't loop.
  useEffect(() => {
    if (!company) return;
    const live = new Set((company.contacts || []).map((contact) => contact._id));
    setSelectedContactIds((prev) => {
      const next = new Set([...prev].filter((contactId) => live.has(contactId)));
      return next.size === prev.size ? prev : next;
    });
  }, [company]);

  function toggleContact(contactId) {
    setSelectedContactIds((prev) => {
      const next = new Set(prev);
      if (next.has(contactId)) next.delete(contactId);
      else next.add(contactId);
      return next;
    });
  }

  function toggleExpanded(contactId) {
    setExpandedDraftIds((prev) => {
      const next = new Set(prev);
      if (next.has(contactId)) next.delete(contactId);
      else next.add(contactId);
      return next;
    });
  }

  async function saveCompanyPayload(payload) {
    const res = await apiFetch(`${OUTREACH_API}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Couldn't save these changes.");
    setCompany(data.company);
    return data.company;
  }

  async function updateMasterResumeId(value) {
    setSavingResume(true);
    setError("");
    try {
      await saveCompanyPayload({ ...company, masterResumeId: value === "none" ? "" : value });
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingResume(false);
    }
  }

  function startEditing() {
    setEditForm(editFormFromCompany(company));
    setEditError("");
    setIsEditing(true);
  }

  async function saveEdit() {
    if (!editForm.companyName.trim() || !editForm.contacts.every((contact) => contact.name.trim())) return;
    setSavingEdit(true);
    setEditError("");
    try {
      await saveCompanyPayload({ ...editForm, masterResumeId: company.masterResumeId });
      setIsEditing(false);
    } catch (err) {
      setEditError(err.message);
    } finally {
      setSavingEdit(false);
    }
  }

  async function deleteCompany() {
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await apiFetch(`${OUTREACH_API}/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't delete this company.");
      navigate("/outreach");
    } catch (err) {
      setDeleteError(err.message);
      setDeleting(false);
    }
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

    const targets = (company.contacts || []).filter((contact) => selectedContactIds.has(contact._id));
    if (targets.length === 0) {
      setGenerateError("Those contacts are no longer available — reselect them and try again.");
      setGenerating(false);
      return;
    }

    const results = [];
    for (const contact of targets) {
      try {
        const res = await apiFetch(`${OUTREACH_API}/${id}/contacts/${contact._id}/generate-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ goal: generateGoal, referralRole: referralRole.trim() }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Couldn't generate this email.");
        results.push({
          contactId: contact._id,
          contactName: contact.name,
          subject: data.subject,
          body: data.body,
          copiedSubject: false,
          copiedBody: false,
          error: "",
        });
      } catch (err) {
        results.push({
          contactId: contact._id,
          contactName: contact.name,
          subject: "",
          body: "",
          copiedSubject: false,
          copiedBody: false,
          error: err.message,
        });
      }
    }

    // Merge rather than replace — an older draft for a contact not in this
    // batch stays visible, and the new ones replace any prior draft for the
    // same contact by id.
    setDrafts((prev) => {
      const byId = new Map(prev.map((draft) => [draft.contactId, draft]));
      results.forEach((draft) => byId.set(draft.contactId, draft));
      return [...byId.values()];
    });
    setExpandedDraftIds((prev) => new Set([...prev, ...results.map((draft) => draft.contactId)]));
    setGenerating(false);
  }

  function updateDraft(contactId, field, value) {
    setDrafts((prev) =>
      prev.map((draft) =>
        draft.contactId === contactId ? { ...draft, [field]: value, copiedSubject: false, copiedBody: false } : draft
      )
    );
  }

  async function copyField(contactId, field) {
    const draft = drafts.find((d) => d.contactId === contactId);
    if (!draft) return;
    await navigator.clipboard.writeText(field === "subject" ? draft.subject : draft.body);
    const flag = field === "subject" ? "copiedSubject" : "copiedBody";
    setDrafts((prev) => prev.map((d) => (d.contactId === contactId ? { ...d, [flag]: true } : d)));
  }

  // Shared by both delete paths below — clears lastGeneratedEmail for the
  // given contacts via the same whole-object PATCH the resume-link picker
  // already uses, so a "deleted" draft doesn't silently come back on the
  // next page load the way the pre-fix hydration bug did.
  async function clearGeneratedEmails(contactIds) {
    const clearSet = new Set(contactIds);
    const contacts = (company.contacts || []).map((contact) => {
      if (!clearSet.has(contact._id)) return contact;
      const { lastGeneratedEmail: _lastGeneratedEmail, ...rest } = contact;
      return rest;
    });
    await saveCompanyPayload({ ...company, contacts });
  }

  async function deleteDraft(contactId) {
    setDrafts((prev) => prev.filter((draft) => draft.contactId !== contactId));
    setExpandedDraftIds((prev) => {
      const next = new Set(prev);
      next.delete(contactId);
      return next;
    });
    try {
      await clearGeneratedEmails([contactId]);
    } catch (err) {
      setError(err.message);
    }
  }

  async function clearAllDrafts() {
    const contactIds = drafts.map((draft) => draft.contactId);
    setDrafts([]);
    setExpandedDraftIds(new Set());
    try {
      await clearGeneratedEmails(contactIds);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="mx-auto w-full max-w-5xl">
      <div className="md:sticky md:top-0 z-10 bg-background pb-10 pt-7 md:pt-10 px-1 md:px-2">
        <Breadcrumbs backTo="/outreach" trail={[{ label: "Outreach Tracker", to: "/outreach" }, { label: company?.companyName || "Company" }]} />
        {company && (
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-display text-2xl font-semibold text-foreground md:text-3xl">{company.companyName}</h1>
                {safeWebsiteUrl(company.websiteUrl) && (
                  <a
                    href={safeWebsiteUrl(company.websiteUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-primary"
                    aria-label={`Open ${company.companyName}'s website`}
                  >
                    <ExternalLink className="size-4" />
                  </a>
                )}
              </div>
              <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground md:text-base">
                {company.location && <span>{company.location}</span>}
                <span>{company.applied ? "Applied" : "Not applied"}</span>
                <Badge className={responseBadgeClassName(company.response)}>{company.response}</Badge>
              </p>
            </div>
            <div className="flex items-center gap-2">
              {!isEditing && (
                <Button size="sm" variant="outline" onClick={startEditing}>
                  <Pencil className="size-4" /> Edit
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="size-4" /> Delete
              </Button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <Alert variant="destructive" className="mb-5">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {loading && <LoadingState message="Loading this company…" />}

      {!loading && company && (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-lg border border-border bg-card p-5 shadow-card">
              {isEditing ? (
                <div className="flex flex-col gap-4">
                  {editError && (
                    <Alert variant="destructive">
                      <AlertDescription>{editError}</AlertDescription>
                    </Alert>
                  )}

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="oc-companyName">Company name</Label>
                    <Input
                      id="oc-companyName"
                      value={editForm.companyName}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, companyName: event.target.value }))}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="oc-location">Location</Label>
                    <Input
                      id="oc-location"
                      value={editForm.location}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, location: event.target.value }))}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="oc-websiteUrl">Website (optional, never fetched)</Label>
                    <Input
                      id="oc-websiteUrl"
                      value={editForm.websiteUrl}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, websiteUrl: event.target.value }))}
                      placeholder="https://…"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="oc-applied"
                      checked={editForm.applied}
                      onCheckedChange={(checked) => setEditForm((prev) => ({ ...prev, applied: checked === true }))}
                    />
                    <Label htmlFor="oc-applied" className="font-normal">
                      Applied
                    </Label>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label>Response</Label>
                    <Select value={editForm.response} onValueChange={(value) => setEditForm((prev) => ({ ...prev, response: value }))}>
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
                    contacts={editForm.contacts}
                    onChange={(contacts) => setEditForm((prev) => ({ ...prev, contacts }))}
                  />

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="oc-notes">Notes</Label>
                    <Textarea
                      id="oc-notes"
                      rows={4}
                      value={editForm.notes}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, notes: event.target.value }))}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={saveEdit}
                      disabled={savingEdit || !editForm.companyName.trim() || !editForm.contacts.every((c) => c.name.trim())}
                    >
                      {savingEdit ? "Saving…" : "Save"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)} disabled={savingEdit}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div>
                    <p className="mb-1 font-mono text-[11px] tracking-wide text-ink-faint uppercase">Location</p>
                    <p className="text-sm text-foreground">{company.location || "Not given."}</p>
                  </div>
                  <div>
                    <p className="mb-1 font-mono text-[11px] tracking-wide text-ink-faint uppercase">Website</p>
                    {safeWebsiteUrl(company.websiteUrl) ? (
                      <a
                        href={safeWebsiteUrl(company.websiteUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary underline underline-offset-2 break-all"
                      >
                        {company.websiteUrl}
                      </a>
                    ) : (
                      <p className="text-sm text-foreground break-all">{company.websiteUrl || "Not given."}</p>
                    )}
                  </div>
                  <div>
                    <p className="mb-1 font-mono text-[11px] tracking-wide text-ink-faint uppercase">Notes</p>
                    <p className="text-sm whitespace-pre-wrap text-foreground">{company.notes || "No notes yet."}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-border bg-card p-5 shadow-card">
              <p className="mb-3 font-mono text-[11px] tracking-wide text-ink-faint uppercase">Contacts for outreach</p>

              <div className="mb-4 flex flex-col gap-1.5">
                <Label>Representing resume</Label>
                <Select
                  value={company.masterResumeId || "none"}
                  onValueChange={updateMasterResumeId}
                  disabled={savingResume}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="No resume linked" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No resume linked</SelectItem>
                    {masterResumes.map((resume) => (
                      <SelectItem key={resume._id} value={resume._id}>
                        {resume.label || resume.personalInfo?.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {(company.contacts || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No contacts yet — click Edit to add some.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {company.contacts.map((contact) => (
                    <li key={contact._id} className="flex items-center gap-3 rounded-md border border-border p-2.5">
                      <Checkbox
                        checked={selectedContactIds.has(contact._id)}
                        onCheckedChange={() => toggleContact(contact._id)}
                        aria-label={`Select ${contact.name}`}
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{contact.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {[contact.role, contact.category || "Other"].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="mt-6 rounded-lg border border-border bg-card p-4 shadow-card">
            <div className="flex flex-col flex-wrap gap-3 sm:flex-row sm:items-end">
              <div className="flex min-w-[220px] flex-1 flex-col gap-1.5 sm:flex-initial sm:basis-56">
                <Label>Goal</Label>
                <Select value={generateGoal} onValueChange={setGenerateGoal}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="speculative">Speculative — ask about a role, or to be kept in mind</SelectItem>
                    <SelectItem value="referral">Referral — ask about a role already applied to elsewhere</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {generateGoal === "referral" && (
                <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
                  <Label htmlFor="referral-role">Which role</Label>
                  <Input
                    id="referral-role"
                    value={referralRole}
                    onChange={(event) => setReferralRole(event.target.value)}
                    placeholder="e.g. the Backend Engineer position"
                  />
                </div>
              )}

              <Button
                className="w-full sm:ml-auto sm:w-auto"
                disabled={generating || selectedContactIds.size === 0}
                onClick={generateEmails}
              >
                <Mail className="size-4" />
                {generating ? "Generating…" : `Generate ${selectedContactIds.size || ""} email${selectedContactIds.size === 1 ? "" : "s"}`}
              </Button>
            </div>

            {generateError && (
              <Alert variant="destructive" className="mt-3">
                <AlertDescription>{generateError}</AlertDescription>
              </Alert>
            )}
          </div>

          {drafts.length > 0 && (
            <div className="mt-6 overflow-hidden rounded-lg border border-border bg-card shadow-card">
              <div className="flex items-center justify-between border-b border-border p-4">
                <p className="font-mono text-[11px] tracking-wide text-ink-faint uppercase">Generated drafts</p>
                <Button variant="ghost" size="sm" onClick={clearAllDrafts}>
                  Clear all
                </Button>
              </div>
              <table className="w-full table-fixed text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th scope="col" className="w-36 py-2.5 pl-4 font-mono text-[11px] font-medium tracking-wide text-ink-faint uppercase sm:w-44">
                      Contact
                    </th>
                    <th scope="col" className="py-2.5 pl-4 font-mono text-[11px] font-medium tracking-wide text-ink-faint uppercase">
                      Subject
                    </th>
                    <th scope="col" className="w-20 py-2.5 pl-4 font-mono text-[11px] font-medium tracking-wide text-ink-faint uppercase sm:w-28">
                      Status
                    </th>
                    <th scope="col" className="w-10" aria-hidden="true" />
                    <th scope="col" className="w-10" aria-hidden="true" />
                  </tr>
                </thead>
                <tbody>
                  {drafts.map((draft) => {
                    const expanded = expandedDraftIds.has(draft.contactId);
                    return (
                      <Fragment key={draft.contactId}>
                        <tr
                          role="button"
                          tabIndex={0}
                          onClick={() => toggleExpanded(draft.contactId)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              toggleExpanded(draft.contactId);
                            }
                          }}
                          className="cursor-pointer border-b border-border last:border-0 hover:bg-secondary/40 focus-visible:outline-none"
                        >
                          <td className="truncate py-3 pl-4 font-medium text-foreground">{draft.contactName}</td>
                          <td className="truncate py-3 pl-4 text-foreground">
                            {draft.error ? <span className="text-muted-foreground">—</span> : draft.subject}
                          </td>
                          <td className="py-3 pl-4">
                            {draft.error ? (
                              <Badge variant="destructive">Error</Badge>
                            ) : draft.copiedSubject && draft.copiedBody ? (
                              <Badge variant="secondary">Copied</Badge>
                            ) : (
                              <Badge variant="outline">Ready</Badge>
                            )}
                          </td>
                          <td className="py-3 text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="text-muted-foreground hover:text-destructive"
                              aria-label={`Delete draft for ${draft.contactName}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                deleteDraft(draft.contactId);
                              }}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </td>
                          <td className="py-3 pr-4 text-right">
                            <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", expanded && "rotate-180")} />
                          </td>
                        </tr>
                        {expanded && (
                          <tr className="border-b border-border bg-secondary/20 last:border-0">
                            <td colSpan={5} className="p-4">
                              {draft.error ? (
                                <Alert variant="destructive">
                                  <AlertDescription>{draft.error}</AlertDescription>
                                </Alert>
                              ) : (
                                <div className="flex flex-col gap-3">
                                  <div className="flex flex-col gap-1.5">
                                    <div className="flex items-center justify-between">
                                      <Label className="text-xs text-muted-foreground">Subject</Label>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        onClick={() => copyField(draft.contactId, "subject")}
                                        aria-label={`Copy subject for ${draft.contactName}`}
                                      >
                                        {draft.copiedSubject ? <Check className="size-4" /> : <Copy className="size-4" />}
                                      </Button>
                                    </div>
                                    <Input
                                      value={draft.subject}
                                      onChange={(event) => updateDraft(draft.contactId, "subject", event.target.value)}
                                      aria-label={`Subject for ${draft.contactName}`}
                                    />
                                  </div>
                                  <div className="flex flex-col gap-1.5">
                                    <div className="flex items-center justify-between">
                                      <Label className="text-xs text-muted-foreground">Body</Label>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        onClick={() => copyField(draft.contactId, "body")}
                                        aria-label={`Copy body for ${draft.contactName}`}
                                      >
                                        {draft.copiedBody ? <Check className="size-4" /> : <Copy className="size-4" />}
                                      </Button>
                                    </div>
                                    <Textarea
                                      rows={6}
                                      value={draft.body}
                                      onChange={(event) => updateDraft(draft.contactId, "body", event.target.value)}
                                      aria-label={`Body for ${draft.contactName}`}
                                    />
                                  </div>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <Dialog open={deleteDialogOpen} onOpenChange={(open) => !open && !deleting && setDeleteDialogOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete "{company?.companyName}"?</DialogTitle>
            <DialogDescription>
              This permanently removes this company and its contacts from your outreach tracker. This can't be undone.
            </DialogDescription>
          </DialogHeader>

          {deleteError && (
            <Alert variant="destructive">
              <AlertDescription>{deleteError}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
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
