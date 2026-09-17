import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { RESUMES_API as API_BASE } from "../lib/api.js";
import { apiFetch } from "../lib/apiFetch.js";
import { buildDateRange } from "../lib/dateRange.js";
import Breadcrumbs from "../components/Breadcrumbs.jsx";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const NEW_EMPLOYER_KEY = "__new__";

// Same role|company|dateRange grouping used everywhere else this app shows
// bullets against their employer (ResumeDetail.jsx's Experience section,
// the Approval page's ExperienceSection.jsx, exportResumeDocx.js) — one
// header per employer instead of repeating it on every single bullet.
// Preserves first-appearance order, so groups still read top-to-bottom the
// same way the flat list used to.
function groupBulletsByEmployer(bullets) {
  const groups = [];
  const groupsByKey = new Map();
  for (const bullet of bullets) {
    const key = `${bullet.role || ""}|${bullet.company || ""}|${bullet.dateRange || ""}`;
    let group = groupsByKey.get(key);
    if (!group) {
      group = { role: bullet.role, company: bullet.company, dateRange: bullet.dateRange, bullets: [] };
      groupsByKey.set(key, group);
      groups.push(group);
    }
    group.bullets.push(bullet);
  }
  return groups;
}

export default function ResumeBullets() {
  const { id } = useParams();

  const [resume, setResume] = useState(null);
  const [bullets, setBullets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const [savingId, setSavingId] = useState(null);

  const [newBulletText, setNewBulletText] = useState("");
  const [newBulletCompany, setNewBulletCompany] = useState("");
  const [newBulletRole, setNewBulletRole] = useState("");
  const [newBulletStartMonth, setNewBulletStartMonth] = useState("");
  const [newBulletEndMonth, setNewBulletEndMonth] = useState("");
  const [newBulletCurrent, setNewBulletCurrent] = useState(false);
  const [selectedEmployerKey, setSelectedEmployerKey] = useState(NEW_EMPLOYER_KEY);
  const [addingBullet, setAddingBullet] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);

  // One grouping computation feeds both the page's own bullet list (grouped
  // under a company/role/date header) and the Add-bullet dialog's "existing
  // employer" dropdown below.
  const bulletGroups = useMemo(() => groupBulletsByEmployer(bullets), [bullets]);

  // Every distinct employer already on this resume, so adding another bullet
  // to one of them means picking it rather than retyping company/role/date
  // range by hand — a typo here would silently read as a different employer.
  const employerOptions = useMemo(
    () =>
      bulletGroups
        .filter((group) => group.company)
        .map((group) => ({
          key: `${group.company}|${group.role || ""}|${group.dateRange || ""}`,
          role: group.role || "",
          company: group.company,
          dateRange: group.dateRange || "",
        })),
    [bulletGroups]
  );

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    async function loadResume() {
      try {
        const res = await apiFetch(`${API_BASE}/${id}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Couldn't load this resume.");
        setResume(data.masterResume);
      } catch {
        // non-fatal — the eyebrow label is a nicety, bullets still load without it
      }
    }
    loadResume();
  }, [id]);

  useEffect(() => {
    async function loadBullets() {
      setLoading(true);
      setError("");
      try {
        const res = await apiFetch(`${API_BASE}/${id}/bullets`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Couldn't load bullets for this resume.");
        setBullets(data.resumeBullets);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadBullets();
  }, [id]);

  function startEditing(bullet) {
    setEditingId(bullet._id);
    setEditingText(bullet.text);
  }

  function cancelEditing() {
    setEditingId(null);
    setEditingText("");
  }

  async function saveEditing(bulletId) {
    if (!editingText.trim()) return;

    setSavingId(bulletId);
    setError("");
    try {
      const res = await apiFetch(`${API_BASE}/bullets/${bulletId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: editingText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't save this bullet.");

      setBullets((prev) =>
        prev.map((bullet) => (bullet._id === bulletId ? data.resumeBullet : bullet))
      );
      setEditingId(null);
      setEditingText("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingId(null);
    }
  }

  function resetAddForm() {
    setNewBulletText("");
    setNewBulletCompany("");
    setNewBulletRole("");
    setNewBulletStartMonth("");
    setNewBulletEndMonth("");
    setNewBulletCurrent(false);
    setSelectedEmployerKey(NEW_EMPLOYER_KEY);
  }

  async function addBullet() {
    if (!newBulletText.trim() || !isNewBulletValid) return;

    const existingEmployer = employerOptions.find((option) => option.key === selectedEmployerKey);
    const employerFields = existingEmployer
      ? { company: existingEmployer.company, role: existingEmployer.role, dateRange: existingEmployer.dateRange }
      : {
          company: newBulletCompany,
          role: newBulletRole,
          dateRange: buildDateRange(newBulletStartMonth, newBulletEndMonth, newBulletCurrent),
        };

    setAddingBullet(true);
    setError("");
    try {
      const res = await apiFetch(`${API_BASE}/${id}/bullets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newBulletText, ...employerFields }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't add this bullet.");

      setBullets((prev) => [...prev, data.resumeBullet]);
      resetAddForm();
      setIsAddOpen(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setAddingBullet(false);
    }
  }

  async function deleteBullet() {
    if (!deleteTarget) return;

    setDeleting(true);
    setDeleteError("");
    try {
      const res = await apiFetch(`${API_BASE}/bullets/${deleteTarget._id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't delete this bullet.");

      setBullets((prev) => prev.filter((bullet) => bullet._id !== deleteTarget._id));
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  // Only the "add a new company" path needs its own fields validated —
  // picking an existing employer already guarantees valid company/role/date.
  const isNewBulletValid =
    selectedEmployerKey !== NEW_EMPLOYER_KEY ||
    (newBulletCompany.trim() && newBulletRole.trim() && newBulletStartMonth && (newBulletEndMonth || newBulletCurrent));

  return (
    <section className="mx-auto w-full max-w-5xl">
      <div className="md:sticky md:top-0 z-10 bg-background pb-10  pt-7 md:pt-10 px=1 md:px-2">
        <Breadcrumbs
          backTo={`/resumes/${id}`}
          trail={[
            { label: "Master Resumes", to: "/resumes" },
            { label: resume?.personalInfo?.fullName || resume?.label || "Resume", to: `/resumes/${id}` },
            { label: "Resume Bullets" },
          ]}
        />
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="font-display text-2xl font-semibold text-foreground md:text-3xl">Resume Bullets</h1>
          <Button size="sm" className="w-fit" onClick={() => setIsAddOpen(true)}>
            <Plus className="size-4" /> Add bullet
          </Button>
        </div>
        <p className="max-w-prose text-sm text-muted-foreground md:text-base">
          Every bullet here is a real line from something you uploaded — editing it here changes
          what gets pulled into every future tailored resume.
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-5">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && <p className="py-4 text-sm text-muted-foreground">Fetching this resume's bullets…</p>}

      {!loading && bullets.length === 0 && !error && (
        <p className="py-4 text-sm text-muted-foreground">
          This resume has no bullets yet — add one above, or upload a file.
        </p>
      )}

      <div className="flex flex-col gap-6">
        {bulletGroups.map((group, groupIndex) => (
          <div key={groupIndex}>
            <div className="mb-3">
              <p className="text-sm font-medium text-foreground">
                {[group.company, group.role].filter(Boolean).join(" — ") || "Untitled role"}
              </p>
              {group.dateRange && (
                <p className="font-mono text-[11px] tracking-wide text-ink-faint uppercase">{group.dateRange}</p>
              )}
            </div>
            <ul className="flex flex-col gap-3">
              {group.bullets.map((bullet) => {
                const isEditing = editingId === bullet._id;
                const isSaving = savingId === bullet._id;

                return (
                  <li
                    key={bullet._id}
                    data-editing={isEditing}
                    className="flex gap-4 rounded-lg border border-border bg-card p-5 shadow-card transition-shadow hover:shadow-[0_2px_4px_rgba(22,33,27,0.06),0_12px_28px_-12px_rgba(22,33,27,0.22)]"
                  >
                    <span className="rb-bullet-strip" aria-hidden="true" />
                    <div className="flex flex-1 flex-col gap-2">
                      {isEditing ? (
                        <>
                          <Textarea
                            value={editingText}
                            onChange={(event) => setEditingText(event.target.value)}
                            rows={3}
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <Button onClick={() => saveEditing(bullet._id)} disabled={isSaving}>
                              {isSaving ? "Saving…" : "Save"}
                            </Button>
                            <Button variant="ghost" onClick={cancelEditing} disabled={isSaving}>
                              Cancel
                            </Button>
                          </div>
                        </>
                      ) : (
                        <>
                          <p className="text-sm text-foreground">{bullet.text}</p>
                          {(bullet.canonicalSkills?.length > 0 || bullet.metrics?.length > 0) && (
                            <div className="flex flex-wrap gap-1.5">
                              {bullet.canonicalSkills?.map((skill) => (
                                <Badge key={skill} variant="secondary">
                                  {skill}
                                </Badge>
                              ))}
                              {bullet.metrics?.map((metric) => (
                                <Badge key={metric} variant="outline">
                                  {metric}
                                </Badge>
                              ))}
                            </div>
                          )}
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-fit"
                              onClick={() => startEditing(bullet)}
                            >
                              <Pencil className="size-4" />
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-fit text-destructive hover:text-destructive"
                              onClick={() => setDeleteTarget(bullet)}
                            >
                              <Trash2 className="size-4" />
                              Delete
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <Dialog open={isAddOpen} onOpenChange={(open) => !addingBullet && setIsAddOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a bullet</DialogTitle>
            <DialogDescription>
              Write or paste a new bullet for this resume — it'll be tagged the same way as an
              uploaded one.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={newBulletText}
            onChange={(event) => setNewBulletText(event.target.value)}
            rows={4}
            placeholder="Paste or write a new bullet…"
            autoFocus
          />

          {employerOptions.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label>Job</Label>
              <Select value={selectedEmployerKey} onValueChange={setSelectedEmployerKey}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NEW_EMPLOYER_KEY}>+ Add a new company</SelectItem>
                  {employerOptions.map((option) => (
                    <SelectItem key={option.key} value={option.key}>
                      {`${[option.company, option.role].filter(Boolean).join(" — ")}${
                        option.dateRange ? ` (${option.dateRange})` : ""
                      }`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {selectedEmployerKey === NEW_EMPLOYER_KEY && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 flex flex-col gap-1.5">
                <Label htmlFor="new-bullet-company">Company</Label>
                <Input
                  id="new-bullet-company"
                  value={newBulletCompany}
                  onChange={(event) => setNewBulletCompany(event.target.value)}
                  placeholder="e.g. Acme Inc."
                />
              </div>
              <div className="col-span-2 flex flex-col gap-1.5">
                <Label htmlFor="new-bullet-role">Role</Label>
                <Input
                  id="new-bullet-role"
                  value={newBulletRole}
                  onChange={(event) => setNewBulletRole(event.target.value)}
                  placeholder="e.g. Software Engineer"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-bullet-start">Start</Label>
                <Input
                  id="new-bullet-start"
                  type="month"
                  value={newBulletStartMonth}
                  onChange={(event) => setNewBulletStartMonth(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-bullet-end">End </Label>
                <Input
                  id="new-bullet-end"
                  type="month"
                  value={newBulletEndMonth}
                  onChange={(event) => setNewBulletEndMonth(event.target.value)}
                  disabled={newBulletCurrent}
                />
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <Checkbox
                  id="new-bullet-current"
                  checked={newBulletCurrent}
                  onCheckedChange={(checked) => setNewBulletCurrent(checked === true)}
                />
                <Label htmlFor="new-bullet-current" className="text-xs font-normal text-muted-foreground">
                  Currently working here
                </Label>
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            {selectedEmployerKey === NEW_EMPLOYER_KEY
              ? "Attaching a company keeps this bullet grouped with that employer's other bullets — and makes sure that employer never disappears from a tailored resume, the same guarantee every other bullet on this page already has."
              : "This bullet will be grouped with that job's other bullets, using its existing role and date range — no need to retype them."}
          </p>
          <DialogFooter>
            <Button onClick={addBullet} disabled={addingBullet || !newBulletText.trim() || !isNewBulletValid}>
              {addingBullet ? "Adding…" : "Add bullet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this bullet?</DialogTitle>
            <DialogDescription>
              This permanently removes it from your master resume — it can't be undone. It won't change
              anything already shown for an application currently in review or already approved. But if
              you later use "Suggest missing skills" on an application that already has this bullet, it
              won't be available to include from that point on.
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
            <Button variant="destructive" onClick={deleteBullet} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
