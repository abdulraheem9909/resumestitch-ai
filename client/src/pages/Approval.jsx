import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { APPLICATIONS_API as API_BASE } from "../lib/api.js";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

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

  const [activeSuggestSkill, setActiveSuggestSkill] = useState(null);
  const [suggestBulletText, setSuggestBulletText] = useState("");
  const [addingSkill, setAddingSkill] = useState(false);

  const [retryNotes, setRetryNotes] = useState("");
  const [sendingRetry, setSendingRetry] = useState(false);
  const [approving, setApproving] = useState(false);

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

  function startEditingBullet(bullet) {
    setEditingBulletId(bullet.bulletId);
    setEditingBulletText(bullet.finalText);
  }

  function cancelEditingBullet() {
    setEditingBulletId(null);
    setEditingBulletText("");
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
      setApplication((prev) => ({ ...prev, humanRecheckAtsFlags: data.humanRecheckAtsFlags }));
    } catch (err) {
      setError(err.message);
    } finally {
      setRechecking(false);
    }
  }

  async function acceptSuggestedSkill(skill) {
    if (!suggestBulletText.trim()) return;

    setAddingSkill(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/${applicationId}/suggest-skills/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skill, bulletText: suggestBulletText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't add this skill.");
      setActiveSuggestSkill(null);
      setSuggestBulletText("");
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

  return (
    <section className="mx-auto w-full max-w-3xl">
      <p className="mb-2.5 font-mono text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Application review
      </p>
      <h1 className="font-display text-3xl font-semibold text-foreground">
        {application?.companyName || "Review application"}
      </h1>
      <p className="mb-8 max-w-prose text-base text-muted-foreground">
        Nothing here is saved or exported until you approve it — hand-edit anything that doesn't
        sound like you, or send it back with notes for another pass.
      </p>

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
                      value={editingSummaryText}
                      onChange={(event) => setEditingSummaryText(event.target.value)}
                      rows={4}
                      autoFocus
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
                <li key={bullet.bulletId} className="rounded-lg border border-border bg-card p-5 shadow-card">
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
                      </div>
                      {isEditing ? (
                        <>
                          <Textarea
                            value={editingBulletText}
                            onChange={(event) => setEditingBulletText(event.target.value)}
                            rows={3}
                            autoFocus
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
                          {application.status !== "approved" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="mt-2 w-fit"
                              onClick={() => startEditingBullet(bullet)}
                            >
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
                        <Badge key={flag} variant="destructive">
                          {flag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {/* ATS score & recruiter feedback (node 9) */}
          {application.atsScore != null && (
            <div className="mb-6 rounded-lg border border-border bg-card p-5 shadow-card">
              <p className="mb-3 font-mono text-[11px] tracking-wide text-ink-faint uppercase">
                ATS score &amp; recruiter feedback
              </p>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge variant={application.atsScore >= 70 ? "secondary" : "destructive"}>
                  ATS score: {application.atsScore}
                </Badge>
                {application.retryCount > 0 && <Badge variant="outline">retries: {application.retryCount}</Badge>}
              </div>
              {application.recruiterFeedback && (
                <p className="mb-3 text-sm text-foreground">{application.recruiterFeedback}</p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {(application.atsFlags || []).length === 0 ? (
                  <Badge variant="secondary">No flags raised</Badge>
                ) : (
                  application.atsFlags.map((flag) => (
                    <Badge key={flag} variant="destructive">
                      {flag}
                    </Badge>
                  ))
                )}
              </div>
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

          {/* Re-check */}
          <div className="mb-6 rounded-lg border border-border bg-card p-5 shadow-card">
            <div className="mb-3 flex items-center justify-between gap-4">
              <p className="font-mono text-[11px] tracking-wide text-ink-faint uppercase">
                Human re-check (informational)
              </p>
              <Button size="sm" variant="outline" onClick={runRecheck} disabled={busy}>
                {rechecking ? "Re-checking…" : "Re-check edited text"}
              </Button>
            </div>
            <p className="mb-2 text-sm text-muted-foreground">
              Re-runs fact-checking against whatever you've saved above. It's informational only — it
              doesn't gate approval and doesn't count as a retry.
            </p>
            {application.humanRecheckAtsFlags && (
              <div className="flex flex-wrap gap-1.5">
                {application.humanRecheckAtsFlags.length === 0 ? (
                  <Badge variant="secondary">No issues found</Badge>
                ) : (
                  application.humanRecheckAtsFlags.map((flag) => (
                    <Badge key={flag} variant="destructive">
                      {flag}
                    </Badge>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Suggest missing skills */}
          {application.keywordGaps?.length > 0 && application.status !== "approved" && (
            <div className="mb-6 rounded-lg border border-border bg-card p-5 shadow-card">
              <p className="mb-3 font-mono text-[11px] tracking-wide text-ink-faint uppercase">
                Skills the job wants that your resume doesn't cover
              </p>
              <div className="flex flex-wrap gap-1.5">
                {application.keywordGaps.map((skill) => (
                  <Button
                    key={skill}
                    size="sm"
                    variant={activeSuggestSkill === skill ? "default" : "outline"}
                    onClick={() => {
                      setActiveSuggestSkill(activeSuggestSkill === skill ? null : skill);
                      setSuggestBulletText("");
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
                  <Textarea
                    value={suggestBulletText}
                    onChange={(event) => setSuggestBulletText(event.target.value)}
                    rows={3}
                    placeholder={`Describe how you used ${activeSuggestSkill}…`}
                    autoFocus
                  />
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
            <Alert>
              <AlertDescription>
                Approved{application.approvedAt ? ` on ${new Date(application.approvedAt).toLocaleString()}` : ""}.
              </AlertDescription>
            </Alert>
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
