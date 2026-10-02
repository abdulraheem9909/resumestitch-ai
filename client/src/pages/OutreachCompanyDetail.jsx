import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ExternalLink, Mail, Pencil, Trash2 } from "lucide-react";
import { OUTREACH_API, RESUMES_API } from "../lib/api.js";
import { apiFetch } from "../lib/apiFetch.js";
import Breadcrumbs from "../components/Breadcrumbs.jsx";
import { LoadingState } from "../components/LoadingState.jsx";
import { ContactsFieldArray } from "../components/ContactsFieldArray.jsx";
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
    })),
  };
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

  useEffect(() => {
    async function loadCompany() {
      setLoading(true);
      setError("");
      try {
        const res = await apiFetch(`${OUTREACH_API}/${id}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Couldn't load this company.");
        setCompany(data.company);
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
        results.push({ contactId: contact._id, contactName: contact.name, subject: data.subject, body: data.body, copied: false, error: "" });
      } catch (err) {
        results.push({ contactId: contact._id, contactName: contact.name, subject: "", body: "", copied: false, error: err.message });
      }
    }

    setDrafts(results);
    setGenerating(false);
  }

  function updateDraft(contactId, field, value) {
    setDrafts((prev) => prev.map((draft) => (draft.contactId === contactId ? { ...draft, [field]: value, copied: false } : draft)));
  }

  async function copyDraft(contactId) {
    const draft = drafts.find((d) => d.contactId === contactId);
    if (!draft) return;
    await navigator.clipboard.writeText(`Subject: ${draft.subject}\n\n${draft.body}`);
    setDrafts((prev) => prev.map((d) => (d.contactId === contactId ? { ...d, copied: true } : d)));
  }

  return (
    <section className="mx-auto w-full max-w-5xl">
      <div className="md:sticky md:top-0 z-10 bg-background pb-10 pt-7 md:pt-10 px-1 md:px-2">
        <Breadcrumbs backTo="/outreach" trail={[{ label: "Outreach Tracker", to: "/outreach" }, { label: company?.companyName || "Company" }]} />
        {company && (
          <>
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
          </>
        )}
      </div>

      {error && (
        <Alert variant="destructive" className="mb-5">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {loading && <LoadingState message="Loading this company…" />}

      {!loading && company && (
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

          <div className="flex flex-col gap-6">
            <div className="rounded-lg border border-border bg-card p-5 shadow-card">
              <p className="mb-3 font-mono text-[11px] tracking-wide text-ink-faint uppercase">Contacts for outreach</p>

              <div className="mb-4 flex flex-col gap-1.5">
                <Label>Representing resume</Label>
                <Select
                  value={company.masterResumeId || "none"}
                  onValueChange={updateMasterResumeId}
                  disabled={savingResume}
                >
                  <SelectTrigger>
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

            <div className="rounded-lg border border-border bg-card p-5 shadow-card">
              <p className="mb-3 font-mono text-[11px] tracking-wide text-ink-faint uppercase">Generate email</p>

              {generateError && (
                <Alert variant="destructive" className="mb-3">
                  <AlertDescription>{generateError}</AlertDescription>
                </Alert>
              )}

              <div className="flex flex-col gap-3">
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

                <Button
                  size="sm"
                  className="w-fit"
                  disabled={generating || selectedContactIds.size === 0}
                  onClick={generateEmails}
                >
                  <Mail className="size-4" />
                  {generating ? "Generating…" : `Generate ${selectedContactIds.size || ""} email${selectedContactIds.size === 1 ? "" : "s"}`}
                </Button>
              </div>

              {drafts.length > 0 && (
                <div className="mt-5 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">Generated drafts</p>
                    <Button variant="ghost" size="sm" onClick={() => setDrafts([])}>
                      Clear
                    </Button>
                  </div>
                  {drafts.map((draft) => (
                    <div key={draft.contactId} className="rounded-md border border-border p-3">
                      <p className="mb-2 text-sm font-medium text-foreground">{draft.contactName}</p>
                      {draft.error ? (
                        <Alert variant="destructive">
                          <AlertDescription>{draft.error}</AlertDescription>
                        </Alert>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <Input
                            value={draft.subject}
                            onChange={(event) => updateDraft(draft.contactId, "subject", event.target.value)}
                            aria-label={`Subject for ${draft.contactName}`}
                          />
                          <Textarea
                            rows={6}
                            value={draft.body}
                            onChange={(event) => updateDraft(draft.contactId, "body", event.target.value)}
                            aria-label={`Body for ${draft.contactName}`}
                          />
                          <Button size="sm" variant="outline" className="w-fit" onClick={() => copyDraft(draft.contactId)}>
                            {draft.copied ? "Copied!" : "Copy"}
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
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
