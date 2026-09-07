import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Info } from "lucide-react";
import { APPLICATIONS_API as API_BASE, RESUMES_API } from "../lib/api.js";
import { apiFetch } from "../lib/apiFetch.js";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StaleScoreToast } from "../components/approval/StaleScoreToast.jsx";
import { ApprovalHeader } from "../components/approval/ApprovalHeader.jsx";
import { JobDetailsPanel } from "../components/approval/JobDetailsPanel.jsx";
import { CandidateInfoCard } from "../components/approval/CandidateInfoCard.jsx";
import { TailoredTitleCard } from "../components/approval/TailoredTitleCard.jsx";
import { TailoredSummaryCard } from "../components/approval/TailoredSummaryCard.jsx";
import { ExperienceSection, groupTailoredBulletsByEmployer } from "../components/approval/ExperienceSection.jsx";
import { EducationCard } from "../components/approval/EducationCard.jsx";
import { ProjectsCard } from "../components/approval/ProjectsCard.jsx";
import { CertificationsCard } from "../components/approval/CertificationsCard.jsx";
import { VolunteerWorkCard } from "../components/approval/VolunteerWorkCard.jsx";
import { SkillsCard } from "../components/approval/SkillsCard.jsx";
import { CoverageCheckCard } from "../components/approval/CoverageCheckCard.jsx";
import { AtsScoreSummary } from "../components/approval/AtsScoreSummary.jsx";
import { AtsFeedbackCard } from "../components/approval/AtsFeedbackCard.jsx";
import { CoverLetterCard } from "../components/approval/CoverLetterCard.jsx";
import { SuggestSkillsCard } from "../components/approval/SuggestSkillsCard.jsx";
import { SearchabilityCheckCard } from "../components/approval/SearchabilityCheckCard.jsx";
import { SkillFrequencyCard } from "../components/approval/SkillFrequencyCard.jsx";
import { ApprovalActions } from "../components/approval/ApprovalActions.jsx";
import { CompareTab } from "../components/approval/CompareTab.jsx";

export default function Approval() {
  const { applicationId } = useParams();
  const navigate = useNavigate();

  const [application, setApplication] = useState(null);
  const [masterResume, setMasterResume] = useState(null);
  const [originalBullets, setOriginalBullets] = useState([]);
  const [originalSummary, setOriginalSummary] = useState("");
  const [originalProjects, setOriginalProjects] = useState([]);
  const [originalEducation, setOriginalEducation] = useState([]);
  const [originalCertifications, setOriginalCertifications] = useState([]);
  const [originalVolunteerWork, setOriginalVolunteerWork] = useState([]);
  const [masterResumeChanged, setMasterResumeChanged] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [roleFitReason, setRoleFitReason] = useState("");
  const [verifiedSkills, setVerifiedSkills] = useState([]);
  const [skillMatchTypes, setSkillMatchTypes] = useState({});
  const [skillInput, setSkillInput] = useState("");
  const [savingSkills, setSavingSkills] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editingBulletId, setEditingBulletId] = useState(null);
  const [editingBulletText, setEditingBulletText] = useState("");
  const [savingBulletId, setSavingBulletId] = useState(null);

  const [editingSummary, setEditingSummary] = useState(false);
  const [editingSummaryText, setEditingSummaryText] = useState("");
  const [savingSummary, setSavingSummary] = useState(false);

  const [editingTitle, setEditingTitle] = useState(false);
  const [editingTitleText, setEditingTitleText] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);
  const [titleSeniorityWarning, setTitleSeniorityWarning] = useState([]);

  // True the moment any edit/include-exclude action saves successfully,
  // false once a re-check (or a retry, which already re-checks on its own)
  // brings the displayed score/feedback back in sync with what's on screen.
  const [dirtySinceCheck, setDirtySinceCheck] = useState(false);

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

  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [discardError, setDiscardError] = useState("");

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
      const res = await apiFetch(`${API_BASE}/${applicationId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't load this application.");
      setApplication(data.application);
      setOriginalBullets(data.originalBullets || []);
      setOriginalSummary(data.originalSummary || "");
      setOriginalProjects(data.originalProjects || []);
      setOriginalEducation(data.originalEducation || []);
      setOriginalCertifications(data.originalCertifications || []);
      setOriginalVolunteerWork(data.originalVolunteerWork || []);
      setMasterResumeChanged(Boolean(data.masterResumeChanged));
      setVerificationResult(data.verificationResult || null);
      setRoleFitReason(data.roleFitReason || "");
      setVerifiedSkills(data.verifiedSkills || []);
      setSkillMatchTypes(data.skillMatchTypes || {});
      setTitleSeniorityWarning(data.titleSeniorityWarning || []);
      setDirtySinceCheck(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    loadApplication();
  }, [loadApplication]);

  // Read-only CV shape (name, contact, education, projects, skills) — lives on
  // the master resume, not the application, so it's a separate fetch once we
  // know which resume this application was tailored from.
  useEffect(() => {
    if (!application?.masterResumeId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(`${RESUMES_API}/${application.masterResumeId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Couldn't load resume details.");
        if (!cancelled) setMasterResume(data.masterResume);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [application?.masterResumeId]);

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
  const bulletGroups = useMemo(
    () => groupTailoredBulletsByEmployer(application?.tailoredBullets || [], originalsById),
    [application?.tailoredBullets, originalsById]
  );
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
      const res = await apiFetch(`${API_BASE}/${applicationId}/bullets/${bulletId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rejected: nextRejected }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't update this bullet.");
      setApplication(data.application);
      setVerifiedSkills(data.verifiedSkills || []);
      setSkillMatchTypes(data.skillMatchTypes || {});
      setDirtySinceCheck(true);
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
      const res = await apiFetch(`${API_BASE}/${applicationId}/bullets/${bulletId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: editingBulletText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't save this bullet.");
      setApplication(data.application);
      setVerifiedSkills(data.verifiedSkills || []);
      setSkillMatchTypes(data.skillMatchTypes || {});
      setEditingBulletId(null);
      setEditingBulletText("");
      setDirtySinceCheck(true);
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
      const res = await apiFetch(`${API_BASE}/${applicationId}/summary`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: editingSummaryText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't save the summary.");
      setApplication(data.application);
      setEditingSummary(false);
      setEditingSummaryText("");
      setDirtySinceCheck(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingSummary(false);
    }
  }

  function startEditingTitle() {
    setEditingTitle(true);
    setEditingTitleText(application.tailoredTitle.finalText);
  }

  async function saveTitle() {
    if (!editingTitleText.trim()) return;

    setSavingTitle(true);
    setError("");
    try {
      const res = await apiFetch(`${API_BASE}/${applicationId}/title`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: editingTitleText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't save the title.");
      setApplication(data.application);
      setTitleSeniorityWarning(data.titleSeniorityWarning || []);
      setEditingTitle(false);
      setEditingTitleText("");
      setDirtySinceCheck(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingTitle(false);
    }
  }

  async function runRecheck() {
    setRechecking(true);
    setError("");
    try {
      const res = await apiFetch(`${API_BASE}/${applicationId}/recheck`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't re-check this application.");
      setApplication((prev) => ({
        ...prev,
        humanRecheckAtsScore: data.humanRecheckAtsScore,
        humanRecheckAtsFlags: data.humanRecheckAtsFlags,
        humanRecheckRecruiterFeedback: data.humanRecheckRecruiterFeedback,
        humanRecheckKeywordGaps: data.humanRecheckKeywordGaps,
      }));
      setDirtySinceCheck(false);
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
      const res = await apiFetch(`${API_BASE}/${applicationId}/suggest-skills/accept`, {
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
      const res = await apiFetch(`${API_BASE}/${applicationId}/resume`, {
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
      const res = await apiFetch(`${API_BASE}/${applicationId}/resume`, {
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

  async function discardApplication() {
    setDiscarding(true);
    setDiscardError("");
    try {
      const res = await apiFetch(`${API_BASE}/${applicationId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't discard this application.");
      navigate("/applications");
    } catch (err) {
      setDiscardError(err.message);
    } finally {
      setDiscarding(false);
    }
  }

  const effectiveSkills = application?.tailoredSkills ?? masterResume?.skills ?? [];

  async function updateSkills(nextSkills) {
    setSavingSkills(true);
    setError("");
    try {
      const res = await apiFetch(`${API_BASE}/${applicationId}/skills`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skills: nextSkills }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't update skills.");
      setApplication(data.application);
      setVerifiedSkills(data.verifiedSkills || []);
      setSkillMatchTypes(data.skillMatchTypes || {});
      setDirtySinceCheck(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingSkills(false);
    }
  }

  function addSkill() {
    const value = skillInput.trim();
    if (!value || effectiveSkills.includes(value)) {
      setSkillInput("");
      return;
    }
    updateSkills([...effectiveSkills, value]);
    setSkillInput("");
  }

  function removeSkill(skill) {
    updateSkills(effectiveSkills.filter((existing) => existing !== skill));
  }

  const busy =
    savingBulletId !== null ||
    savingSummary ||
    savingTitle ||
    rechecking ||
    addingSkill ||
    savingSkills ||
    sendingRetry ||
    approving ||
    discarding;

  // Once a re-check has run, its result is "current" and the original AI pass
  // becomes historical — shown only on request, never side-by-side with equal
  // weight, so there's never a moment where two scores compete for attention.
  const hasRecheck = application?.humanRecheckAtsScore != null;
  const currentAtsScore = hasRecheck ? application.humanRecheckAtsScore : application?.atsScore;
  const currentRecruiterFeedback = hasRecheck
    ? application?.humanRecheckRecruiterFeedback
    : application?.recruiterFeedback;
  const currentAtsFlags = hasRecheck ? application?.humanRecheckAtsFlags || [] : application?.atsFlags || [];

  const editingBulletState = {
    editingBulletId,
    editingBulletText,
    setEditingBulletText,
    savingBulletId,
    bulletTextareaRef,
  };
  const bulletActions = {
    onToggleRejected: toggleBulletRejected,
    onStartEdit: startEditingBullet,
    onCancelEdit: cancelEditingBullet,
    onSaveBullet: saveBullet,
  };

  return (
    <section className="mx-auto w-full max-w-[100rem]">
      {application && dirtySinceCheck && application.status !== "approved" && (
        <StaleScoreToast rechecking={rechecking} busy={busy} onRecheck={runRecheck} />
      )}

      <ApprovalHeader
        application={application}
        applicationId={applicationId}
        discardDialogOpen={discardDialogOpen}
        setDiscardDialogOpen={setDiscardDialogOpen}
        discardError={discardError}
        discarding={discarding}
        busy={busy}
        onDiscard={discardApplication}
      />

      {error && (
        <Alert variant="destructive" className="mb-5">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && <p className="py-4 text-sm text-muted-foreground">Loading this application…</p>}

      {!loading && application && masterResumeChanged && (
        <Alert className="mb-5 border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
          <Info className="size-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="text-blue-900 dark:text-blue-200">
            Your master resume has changed since this application was created. The bullets,
            summary, title, education, certifications, projects, and volunteer work shown here
            reflect the resume as it was back then. Retry won't update them — start a new
            application to use the latest resume.
          </AlertDescription>
        </Alert>
      )}

      {!loading && application?.status === "role_mismatch" && (
        <Alert variant="destructive">
          <AlertDescription>
            <p className="mb-1 font-medium">This job description doesn't look like a fit for this resume.</p>
            <p>{roleFitReason || "No specific reason was recorded."}</p>
          </AlertDescription>
        </Alert>
      )}

      {!loading && application && application.status !== "role_mismatch" && (
        <Tabs defaultValue="report">
          <TabsList className="mb-5 h-11 w-full">
            <TabsTrigger value="report">Report</TabsTrigger>
            <TabsTrigger value="compare">Compare</TabsTrigger>
            <TabsTrigger value="job-details">Job Details</TabsTrigger>
          </TabsList>

          <TabsContent value="job-details">
            <JobDetailsPanel application={application} />
          </TabsContent>

          <TabsContent value="compare">
            <CompareTab
              application={application}
              masterResume={masterResume}
              originalsById={originalsById}
              originalSummary={originalSummary}
              originalEducation={originalEducation}
              originalProjects={originalProjects}
              originalCertifications={originalCertifications}
              originalVolunteerWork={originalVolunteerWork}
              effectiveSkills={effectiveSkills}
              bulletGroups={bulletGroups}
            />
          </TabsContent>

          <TabsContent value="report">
          <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_460px] lg:items-start">
            <div className="flex flex-col">
              {/* Candidate info — read-only, from the master resume */}
              {masterResume && <CandidateInfoCard masterResume={masterResume} />}

              {/* Tailored title */}
              {application.tailoredTitle && (
                <TailoredTitleCard
                  application={application}
                  masterResume={masterResume}
                  titleSeniorityWarning={titleSeniorityWarning}
                  editingTitle={editingTitle}
                  editingTitleText={editingTitleText}
                  setEditingTitleText={setEditingTitleText}
                  savingTitle={savingTitle}
                  onStartEdit={startEditingTitle}
                  onSave={saveTitle}
                  onCancel={() => setEditingTitle(false)}
                />
              )}

              {/* Tailored summary */}
              <TailoredSummaryCard
                application={application}
                originalSummary={originalSummary}
                editingSummary={editingSummary}
                editingSummaryText={editingSummaryText}
                setEditingSummaryText={setEditingSummaryText}
                savingSummary={savingSummary}
                summaryTextareaRef={summaryTextareaRef}
                onStartEdit={startEditingSummary}
                onSave={saveSummary}
                onCancel={() => setEditingSummary(false)}
              />

              {/* Tailored bullets, grouped by employer — same shape as the exported resume */}
              <ExperienceSection
                bulletGroups={bulletGroups}
                originalsById={originalsById}
                verificationByBulletId={verificationByBulletId}
                applicationStatus={application.status}
                editingState={editingBulletState}
                bulletActions={bulletActions}
              />

              {/* Education / Certifications / Projects / Volunteer Work — read-only,
                  frozen at this application's creation (see jobAgentGraph.js) rather
                  than the live master resume, so this always matches what was
                  actually scored/exported for this application. */}
              {originalEducation.length > 0 && <EducationCard education={originalEducation} />}

              {originalCertifications.length > 0 && (
                <CertificationsCard certifications={originalCertifications} />
              )}

              {originalProjects.length > 0 && <ProjectsCard projects={originalProjects} />}

              {originalVolunteerWork.length > 0 && (
                <VolunteerWorkCard volunteerWork={originalVolunteerWork} />
              )}

              {/* Cover letter (node 7, conditional) */}
              {application.coverLetterRequested && (
                <CoverLetterCard coverLetterText={application.coverLetterText} />
              )}
            </div>

            <div className="flex flex-col">
              {/* Always-visible, at-a-glance context */}
              {currentAtsScore != null && (
                <AtsScoreSummary currentAtsScore={currentAtsScore} currentAtsFlags={currentAtsFlags} />
              )}

              {/* Recruiter feedback, re-check action, and the historical
                  before/after reveal — always shows whichever is current: the
                  original AI pass, or the re-check once one has run. */}
              {currentAtsScore != null && (
                <AtsFeedbackCard
                  application={application}
                  currentRecruiterFeedback={currentRecruiterFeedback}
                  hasRecheck={hasRecheck}
                  rechecking={rechecking}
                  busy={busy}
                  showOriginalFeedback={showOriginalFeedback}
                  setShowOriginalFeedback={setShowOriginalFeedback}
                  onRecheck={runRecheck}
                />
              )}

              {/* Bullets-kept and employer representation — same data as
                  before, now a real visual treatment instead of plain badges. */}
              <CoverageCheckCard application={application} bulletGroups={bulletGroups} />

              {masterResume && (
                <SkillsCard
                  effectiveSkills={effectiveSkills}
                  verifiedSkills={verifiedSkills}
                  skillMatchTypes={skillMatchTypes}
                  skillInput={skillInput}
                  setSkillInput={setSkillInput}
                  busy={busy}
                  applicationStatus={application.status}
                  onAddSkill={addSkill}
                  onRemoveSkill={removeSkill}
                />
              )}

              {/* Open-by-default diagnostics, still collapsible */}

              {/* Read-only, non-blocking diagnostic — open by default,
                  fetched on mount (GET /:id/skill-frequency). Hosts the JD
                  skill-match bar above its own detail table (matched =
                  jdCanonicalSkills minus the current keyword-gap list, both
                  already on the application document from node 3/gap
                  analysis — purely a display computation). */}
              <SkillFrequencyCard
                applicationId={applicationId}
                jdCanonicalSkills={application.jdCanonicalSkills}
                keywordGaps={effectiveKeywordGaps}
                // Changes on both save paths that can affect this card's
                // result: a bullet/summary edit (which replaces `application`
                // wholesale, changing `updatedAt`) and Re-check (which only
                // merges its own humanRecheck* fields in, never touching
                // `updatedAt` — so that alone isn't enough on its own).
                refreshKey={`${application.updatedAt}:${(application.humanRecheckKeywordGaps || []).join(",")}`}
              />

              {/* Suggest missing skills — sits right above the decision
                  (send back / approve) it's meant to inform. */}
              {effectiveKeywordGaps.length > 0 && application.status !== "approved" && (
                <SuggestSkillsCard
                  effectiveKeywordGaps={effectiveKeywordGaps}
                  employerOptions={employerOptions}
                  activeSuggestSkill={activeSuggestSkill}
                  setActiveSuggestSkill={setActiveSuggestSkill}
                  suggestBulletText={suggestBulletText}
                  setSuggestBulletText={setSuggestBulletText}
                  suggestBulletTarget={suggestBulletTarget}
                  setSuggestBulletTarget={setSuggestBulletTarget}
                  saveToMasterResume={saveToMasterResume}
                  setSaveToMasterResume={setSaveToMasterResume}
                  suggestTextareaRef={suggestTextareaRef}
                  addingSkill={addingSkill}
                  onAccept={acceptSuggestedSkill}
                />
              )}

              {/* Read-only, non-blocking diagnostic against the current export build —
                  open by default, fetched on mount (GET /:id/searchability-check) */}
              <SearchabilityCheckCard applicationId={applicationId} />

              {application.status !== "approved" && (
                <ApprovalActions
                  retryNotes={retryNotes}
                  setRetryNotes={setRetryNotes}
                  sendingRetry={sendingRetry}
                  approving={approving}
                  busy={busy}
                  onSendBack={sendBackWithNotes}
                  onApprove={approve}
                />
              )}
            </div>
          </div>
          </TabsContent>
        </Tabs>
      )}
    </section>
  );
}
