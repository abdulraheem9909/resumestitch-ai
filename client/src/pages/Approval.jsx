import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Download, Pencil } from "lucide-react";
import { APPLICATIONS_API as API_BASE } from "../lib/api.js";
import Breadcrumbs from "../components/Breadcrumbs.jsx";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Approval() {
  const { applicationId } = useParams();

  const [application, setApplication] = useState(null);
  const [originalBullets, setOriginalBullets] = useState([]);
  const [originalSummary, setOriginalSummary] = useState("");
  const [verificationResult, setVerificationResult] = useState(null);
  const [roleFitReason, setRoleFitReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editingBulletId, setEditingBulletId] = useState(null);
  const [editingBulletText, setEditingBulletText] = useState("");
  const [savingBulletId, setSavingBulletId] = useState(null);

  const [editingSummary, setEditingSummary] = useState(false);
  const [editingSummaryText, setEditingSummaryText] = useState("");
  const [savingSummary, setSavingSummary] = useState(false);

  const [rechecking, setRechecking] = useState(false);
  const [showOriginalFeedback, setShowOriginalFeedback] = useState(false);

  const [activeSuggestSkill, setActiveSuggestSkill] = useState(null);
  const [suggestBulletText, setSuggestBulletText] = useState("");
  const [suggestBulletTarget, setSuggestBulletTarget] = useState("");
  const [saveToMasterResume, setSaveToMasterResume] = useState(true);
  const [addingSkill, setAddingSkill] = useState(false);

  const [retryNotes, setRetryNotes] = useState("");
  const [sendingRetry, setSendingRetry] = useState(false);
  const [approving, setApproving] = useState(false);

  // Focus each text box as it appears without letting the browser's default
  // autoFocus behavior yank the page's scroll position to wherever that box
  // happens to sit — preventScroll keeps the cursor ready without the jump.
  const summaryTextareaRef = useRef(null);
  const bulletTextareaRef = useRef(null);
  const suggestTextareaRef = useRef(null);

  useEffect(() => {
    if (editingSummary) summaryTextareaRef.current?.focus({ preventScroll: true });
  }, [editingSummary]);

  useEffect(() => {
    if (editingBulletId) bulletTextareaRef.current?.focus({ preventScroll: true });
  }, [editingBulletId]);

  useEffect(() => {
    if (activeSuggestSkill) suggestTextareaRef.current?.focus({ preventScroll: true });
  }, [activeSuggestSkill]);

  const loadApplication = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/${applicationId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't load this application.");
      setApplication(data.application);
      setOriginalBullets(data.originalBullets || []);
      setOriginalSummary(data.originalSummary || "");
      setVerificationResult(data.verificationResult || null);
      setRoleFitReason(data.roleFitReason || "");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    loadApplication();
  }, [loadApplication]);

  const originalsById = useMemo(
    () => new Map(originalBullets.map((bullet) => [bullet.bulletId, bullet])),
    [originalBullets]
  );
  const verificationByBulletId = useMemo(
    () => new Map((verificationResult?.bullets || []).map((entry) => [entry.bulletId, entry])),
    [verificationResult]
  );
  const employerOptions = useMemo(() => {
    const seen = new Map();
    for (const bullet of originalBullets) {
      if (!bullet.company) continue;
      const key = `${bullet.company}|${bullet.role || ""}|${bullet.dateRange || ""}`;
      if (!seen.has(key)) {
        seen.set(key, { key, role: bullet.role || "", company: bullet.company, dateRange: bullet.dateRange || "" });
      }
    }
    return [...seen.values()];
  }, [originalBullets]);
  // Falls back to the original AI-time gap list until a re-check has run —
  // once it has, the re-check's live view (which credits anything your
  // current edits actually cover) is the accurate one to show and act on.
  const effectiveKeywordGaps = useMemo(
    () => application?.humanRecheckKeywordGaps ?? application?.keywordGaps ?? [],
    [application?.humanRecheckKeywordGaps, application?.keywordGaps]
  );

  function startEditingBullet(bullet) {
    setEditingBulletId(bullet.bulletId);
    setEditingBulletText(bullet.finalText);
  }

  function cancelEditingBullet() {
    setEditingBulletId(null);
    setEditingBulletText("");
  }

  async function toggleBulletRejected(bulletId, nextRejected) {
    setSavingBulletId(bulletId);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/${applicationId}/bullets/${bulletId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rejected: nextRejected }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't update this bullet.");
      setApplication(data.application);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingBulletId(null);
    }
  }

  async function saveBullet(bulletId) {
    if (!editingBulletText.trim()) return;

    setSavingBulletId(bulletId);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/${applicationId}/bullets/${bulletId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: editingBulletText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't save this bullet.");
      setApplication(data.application);
      setEditingBulletId(null);
      setEditingBulletText("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingBulletId(null);
    }
  }

  function startEditingSummary() {
    setEditingSummary(true);
    setEditingSummaryText(application.tailoredSummary.finalText);
  }

  async function saveSummary() {
    if (!editingSummaryText.trim()) return;

    setSavingSummary(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/${applicationId}/summary`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: editingSummaryText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't save the summary.");
      setApplication(data.application);
      setEditingSummary(false);
      setEditingSummaryText("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingSummary(false);
    }
  }

  async function runRecheck() {
    setRechecking(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/${applicationId}/recheck`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't re-check this application.");
      setApplication((prev) => ({
        ...prev,
        humanRecheckAtsScore: data.humanRecheckAtsScore,
        humanRecheckAtsFlags: data.humanRecheckAtsFlags,
        humanRecheckRecruiterFeedback: data.humanRecheckRecruiterFeedback,
        humanRecheckKeywordGaps: data.humanRecheckKeywordGaps,
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setRechecking(false);
    }
  }

  async function acceptSuggestedSkill(skill) {
    if (!suggestBulletText.trim()) return;

    const target = employerOptions.find((option) => option.key === suggestBulletTarget);

    setAddingSkill(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/${applicationId}/suggest-skills/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skill,
          bulletText: suggestBulletText,
          role: target?.role,
          company: target?.company,
          dateRange: target?.dateRange,
          saveToMasterResume,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't add this skill.");
      setActiveSuggestSkill(null);
      setSuggestBulletText("");
      setSuggestBulletTarget("");
      setSaveToMasterResume(true);
      await loadApplication();
    } catch (err) {
      setError(err.message);
    } finally {
      setAddingSkill(false);
    }
  }

  async function sendBackWithNotes() {
    if (!retryNotes.trim()) return;

    setSendingRetry(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/${applicationId}/resume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retry", notes: retryNotes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't send this back for another pass.");
      setRetryNotes("");
      await loadApplication();
    } catch (err) {
      setError(err.message);
    } finally {
      setSendingRetry(false);
    }
  }

  async function approve() {
    setApproving(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/${applicationId}/resume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't approve this application.");
      setApplication(data.application);
    } catch (err) {
      setError(err.message);
    } finally {
      setApproving(false);
    }
  }

  const busy = savingBulletId !== null || savingSummary || rechecking || addingSkill || sendingRetry || approving;

  const applicationLabel = application?.companyName
    ? [application.companyName, application.jobTitle].filter(Boolean).join(" — ")
    : "Review application";

  // Once a re-check has run, its result is "current" and the original AI pass
  // becomes historical — shown only on request, never side-by-side with equal
  // weight, so there's never a moment where two scores compete for attention.
  const hasRecheck = application?.humanRecheckAtsScore != null;
  const currentAtsScore = hasRecheck ? application.humanRecheckAtsScore : application?.atsScore;
  const currentRecruiterFeedback = hasRecheck
    ? application?.humanRecheckRecruiterFeedback
    : application?.recruiterFeedback;
  const currentAtsFlags = hasRecheck ? application?.humanRecheckAtsFlags || [] : application?.atsFlags || [];

  return (
    <section className="mx-auto w-full max-w-5xl">
      <div className="sticky top-0 z-10 bg-background pb-10 pt-7 md:pt-10 px-1 md:px-2">
        <Breadcrumbs
          backTo="/applications"
          trail={[
            { label: "Applications", to: "/applications" },
            { label: applicationLabel },
          ]}
        />
        <h1 className="font-display text-2xl font-semibold text-foreground md:text-3xl">
          {applicationLabel}
        </h1>
        <p className="max-w-prose text-sm text-muted-foreground md:text-base">
          Nothing here is saved or exported until you approve it — hand-edit anything that doesn't
          sound like you, or send it back with notes for another pass.
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-5">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && <p className="py-4 text-sm text-muted-foreground">Loading this application…</p>}

      {!loading && application?.status === "role_mismatch" && (
        <Alert variant="destructive">
          <AlertDescription>
            <p className="mb-1 font-medium">This job description doesn't look like a fit for this resume.</p>
            <p>{roleFitReason || "No specific reason was recorded."}</p>
          </AlertDescription>
        </Alert>
      )}

      {!loading && application && application.status !== "role_mismatch" && (
        <>
          {/* Tailored summary */}
          <div className="mb-6 rounded-lg border border-border bg-card p-5 shadow-card">
            <p className="mb-3 font-mono text-[11px] tracking-wide text-ink-faint uppercase">Summary</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">Original</p>
                <p className="text-sm text-foreground">{originalSummary || "—"}</p>
              </div>
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <p className="text-xs font-medium text-muted-foreground">Tailored</p>
                  {application.tailoredSummary?.editSource && (
                    <Badge variant="secondary">{application.tailoredSummary.editSource}</Badge>
                  )}
                </div>
                {editingSummary ? (
                  <>
                    <Textarea
                      ref={summaryTextareaRef}
                      value={editingSummaryText}
                      onChange={(event) => setEditingSummaryText(event.target.value)}
                      rows={4}
                    />
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" onClick={saveSummary} disabled={savingSummary}>
                        {savingSummary ? "Saving…" : "Save"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingSummary(false)}
                        disabled={savingSummary}
                      >
                        Cancel
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-foreground">{application.tailoredSummary?.finalText}</p>
                    {application.status !== "approved" && (
                      <Button size="sm" variant="ghost" className="mt-2 w-fit" onClick={startEditingSummary}>
                        <Pencil className="size-4" />
                        Edit
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Tailored bullets */}
          <ul className="mb-6 flex flex-col gap-3">
            {application.tailoredBullets?.map((bullet) => {
              const original = originalsById.get(bullet.sourceBulletId);
              const verification = verificationByBulletId.get(bullet.bulletId);
              const isEditing = editingBulletId === bullet.bulletId;
              const isSaving = savingBulletId === bullet.bulletId;
              const flags = [
                ...(verification?.fabricatedSkills || []),
                ...(verification?.fabricatedMetrics || []),
              ];

              return (
                <li
                  key={bullet.bulletId}
                  className={`rounded-lg border border-border bg-card p-5 shadow-card${bullet.rejected ? " opacity-60" : ""}`}
                >
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <p className="mb-1 text-xs font-medium text-muted-foreground">Original</p>
                      <p className="text-sm text-foreground">{original?.text || "—"}</p>
                    </div>
                    <div>
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <p className="text-xs font-medium text-muted-foreground">Tailored</p>
                        <Badge variant="secondary">{bullet.editSource}</Badge>
                        <Badge variant="outline">rephrase {bullet.rephraseIntensity}</Badge>
                        {bullet.rejected && (
                          <Badge variant="destructive">Out of context — excluded from export</Badge>
                        )}
                      </div>
                      {application.status !== "approved" && (
                        <div className="mb-2 flex items-center gap-2">
                          <Checkbox
                            id={`exclude-${bullet.bulletId}`}
                            checked={bullet.rejected}
                            disabled={isSaving}
                            onCheckedChange={(checked) =>
                              toggleBulletRejected(bullet.bulletId, checked === true)
                            }
                          />
                          <Label
                            htmlFor={`exclude-${bullet.bulletId}`}
                            className="text-xs font-normal text-muted-foreground"
                          >
                            Exclude from resume (out of context)
                          </Label>
                        </div>
                      )}
                      {isEditing ? (
                        <>
                          <Textarea
                            ref={bulletTextareaRef}
                            value={editingBulletText}
                            onChange={(event) => setEditingBulletText(event.target.value)}
                            rows={3}
                          />
                          <div className="mt-2 flex gap-2">
                            <Button size="sm" onClick={() => saveBullet(bullet.bulletId)} disabled={isSaving}>
                              {isSaving ? "Saving…" : "Save"}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={cancelEditingBullet} disabled={isSaving}>
                              Cancel
                            </Button>
                          </div>
                        </>
                      ) : (
                        <>
                          <p className="text-sm text-foreground">{bullet.finalText}</p>
                          {application.status !== "approved" && !bullet.rejected && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="mt-2 w-fit"
                              onClick={() => startEditingBullet(bullet)}
                            >
                              <Pencil className="size-4" />
                              Edit
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  {flags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {flags.map((flag) => (
                        <Badge key={flag} variant="destructive" className="max-w-full min-w-0 shrink flex-wrap whitespace-normal break-words">
                          {flag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {/* ATS score & recruiter feedback — always shows whichever is current: the
              original AI pass, or the re-check once one has run. Never both at once. */}
          {currentAtsScore != null && (
            <div className="mb-6 rounded-lg border border-border bg-card p-5 shadow-card">
              <div className="mb-3 flex items-center justify-between gap-4">
                <p className="font-mono text-[11px] tracking-wide text-ink-faint uppercase">
                  ATS score &amp; recruiter feedback
                </p>
                <Button size="sm" variant="outline" onClick={runRecheck} disabled={busy}>
                  {rechecking ? "Re-checking…" : "Re-check edited text"}
                </Button>
              </div>
              <p className="mb-3 text-sm text-muted-foreground">
                Re-runs fact-checking and ATS/recruiter scoring against whatever you've saved above.
                It's informational only — it doesn't gate approval and doesn't count as a retry.
              </p>

              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge variant={currentAtsScore >= 70 ? "secondary" : "destructive"}>
                  ATS score: {currentAtsScore}
                </Badge>
                {hasRecheck && <Badge variant="secondary">Updated after your edit</Badge>}
                {application.retryCount > 0 && <Badge variant="outline">retries: {application.retryCount}</Badge>}
              </div>
              {currentRecruiterFeedback && (
                <p className="mb-3 text-sm text-foreground">{currentRecruiterFeedback}</p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {currentAtsFlags.length === 0 ? (
                  <Badge variant="secondary">No flags raised</Badge>
                ) : (
                  currentAtsFlags.map((flag) => (
                    <Badge key={flag} variant="destructive" className="max-w-full min-w-0 shrink flex-wrap whitespace-normal break-words">
                      {flag}
                    </Badge>
                  ))
                )}
              </div>

              {hasRecheck && (
                <div className="mt-3 border-t border-border pt-3">
                  <button
                    type="button"
                    className="text-xs font-medium text-muted-foreground hover:text-foreground"
                    onClick={() => setShowOriginalFeedback((prev) => !prev)}
                  >
                    {showOriginalFeedback ? "▾" : "▸"} Show original AI feedback
                  </button>
                  {showOriginalFeedback && (
                    <div className="mt-2">
                      <Badge variant={application.atsScore >= 70 ? "secondary" : "destructive"} className="mb-2">
                        ATS score: {application.atsScore}
                      </Badge>
                      {application.recruiterFeedback && (
                        <p className="mb-2 text-sm text-muted-foreground">{application.recruiterFeedback}</p>
                      )}
                      <div className="flex flex-wrap gap-1.5">
                        {(application.atsFlags || []).length === 0 ? (
                          <Badge variant="secondary">No flags raised</Badge>
                        ) : (
                          application.atsFlags.map((flag) => (
                            <Badge key={flag} variant="outline" className="max-w-full min-w-0 shrink flex-wrap whitespace-normal break-words">
                              {flag}
                            </Badge>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Cover letter (node 7, conditional) */}
          {application.coverLetterRequested && (
            <div className="mb-6 rounded-lg border border-border bg-card p-5 shadow-card">
              <p className="mb-3 font-mono text-[11px] tracking-wide text-ink-faint uppercase">Cover letter</p>
              <p className="whitespace-pre-wrap text-sm text-foreground">
                {application.coverLetterText || "—"}
              </p>
            </div>
          )}

          {/* Suggest missing skills */}
          {effectiveKeywordGaps.length > 0 && application.status !== "approved" && (
            <div className="mb-6 rounded-lg border border-border bg-card p-5 shadow-card">
              <p className="mb-3 font-mono text-[11px] tracking-wide text-ink-faint uppercase">
                Skills the job wants that your resume doesn't cover
              </p>
              <div className="flex flex-wrap gap-1.5">
                {effectiveKeywordGaps.map((skill) => (
                  <Button
                    key={skill}
                    size="sm"
                    variant={activeSuggestSkill === skill ? "default" : "outline"}
                    onClick={() => {
                      setActiveSuggestSkill(activeSuggestSkill === skill ? null : skill);
                      setSuggestBulletText("");
                      setSuggestBulletTarget("");
                      setSaveToMasterResume(true);
                    }}
                  >
                    {skill}
                  </Button>
                ))}
              </div>
              {activeSuggestSkill && (
                <div className="mt-3 flex flex-col gap-2">
                  <p className="text-sm text-muted-foreground">
                    If you genuinely have real experience with "{activeSuggestSkill}", write the real
                    bullet below — it'll be added to your resume and this application retried with it.
                  </p>
                  {employerOptions.length > 0 && (
                    <Select value={suggestBulletTarget} onValueChange={setSuggestBulletTarget}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Attach to which job? (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        {employerOptions.map((option) => (
                          <SelectItem key={option.key} value={option.key}>
                            {[option.company, option.role].filter(Boolean).join(" — ")}
                            {option.dateRange ? ` (${option.dateRange})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Textarea
                    ref={suggestTextareaRef}
                    value={suggestBulletText}
                    onChange={(event) => setSuggestBulletText(event.target.value)}
                    rows={3}
                    placeholder={`Describe how you used ${activeSuggestSkill}…`}
                  />
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="save-to-master-resume"
                      checked={saveToMasterResume}
                      onCheckedChange={(checked) => setSaveToMasterResume(checked === true)}
                    />
                    <Label htmlFor="save-to-master-resume" className="text-xs font-normal text-muted-foreground">
                      Also keep this on my master resume (available to future applications too)
                    </Label>
                  </div>
                  {!saveToMasterResume && (
                    <p className="text-xs text-muted-foreground">
                      This bullet will only be used for this application — it won't be saved to your master
                      resume or show up when tailoring other applications.
                    </p>
                  )}
                  <Button
                    size="sm"
                    className="w-fit"
                    onClick={() => acceptSuggestedSkill(activeSuggestSkill)}
                    disabled={addingSkill || !suggestBulletText.trim()}
                  >
                    {addingSkill ? "Adding…" : "Add & retry"}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Approve / send back */}
          {application.status === "approved" ? (
            <div className="flex flex-col gap-3">
              <Alert>
                <AlertDescription>
                  Approved{application.approvedAt ? ` on ${new Date(application.approvedAt).toLocaleString()}` : ""}.
                </AlertDescription>
              </Alert>
              <div className="flex flex-wrap gap-2">
                <a href={`${API_BASE}/${applicationId}/export/resume.docx`}>
                  <Button size="sm" variant="outline">
                    <Download className="size-4" /> Download resume (.docx)
                  </Button>
                </a>
                {application.coverLetterRequested && (
                  <a href={`${API_BASE}/${applicationId}/export/cover-letter.docx`}>
                    <Button size="sm" variant="outline">
                      <Download className="size-4" /> Download cover letter (.docx)
                    </Button>
                  </a>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-card p-5 shadow-card">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Send back with notes</p>
              <Textarea
                value={retryNotes}
                onChange={(event) => setRetryNotes(event.target.value)}
                rows={3}
                placeholder="What should change on the next pass?"
              />
              <div className="mt-3 flex gap-2">
                <Button
                  variant="outline"
                  onClick={sendBackWithNotes}
                  disabled={busy || !retryNotes.trim()}
                >
                  {sendingRetry ? "Sending…" : "Send back with notes"}
                </Button>
                <Button onClick={approve} disabled={busy}>
                  {approving ? "Approving…" : "Approve"}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
