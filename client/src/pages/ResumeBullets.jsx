import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { RESUMES_API as API_BASE } from "../lib/api.js";
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

// <input type="month"> gives "YYYY-MM" — every date range already on this
// resume (parsed from an upload, or another manually-added bullet) uses
// "MM/YYYY", so convert to match rather than introduce a second format that
// would never group with anything.
function formatMonthYear(value) {
  if (!value) return "";
  const [year, month] = value.split("-");
  if (!year || !month) return "";
  return `${month}/${year}`;
}

function buildDateRange(startMonth, endMonth, isCurrent) {
  const start = formatMonthYear(startMonth);
  if (!start) return "";
  if (isCurrent) return `${start} - Present`;
  const end = formatMonthYear(endMonth);
  return end ? `${start} - ${end}` : start;
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

  // Every distinct employer already on this resume, so adding another bullet
  // to one of them means picking it rather than retyping company/role/date
  // range by hand — a typo here would silently read as a different employer.
  const employerOptions = useMemo(() => {
    const seen = new Map();
    for (const bullet of bullets) {
      if (!bullet.company) continue;
      const key = `${bullet.company}|${bullet.role || ""}|${bullet.dateRange || ""}`;
      if (!seen.has(key)) {
        seen.set(key, { key, role: bullet.role || "", company: bullet.company, dateRange: bullet.dateRange || "" });
      }
    }
    return [...seen.values()];
  }, [bullets]);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    async function loadResume() {
      try {
        const res = await fetch(`${API_BASE}/${id}`);
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
        const res = await fetch(`${API_BASE}/${id}/bullets`);
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
      const res = await fetch(`${API_BASE}/bullets/${bulletId}`, {
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
    if (!newBulletText.trim()) return;

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
      const res = await fetch(`${API_BASE}/${id}/bullets`, {
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
      const res = await fetch(`${API_BASE}/bullets/${deleteTarget._id}`, { method: "DELETE" });
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

  return (
    <section className="mx-auto w-full max-w-5xl">
      <div className="sticky top-0 z-10 bg-background pb-10  pt-7 md:pt-10 px=1 md:px-2">
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

      <ul className="flex flex-col gap-3">
        {bullets.map((bullet) => {
          const isEditing = editingId === bullet._id;
          const isSaving = savingId === bullet._id;
          const meta = [bullet.role, bullet.company, bullet.dateRange].filter(Boolean);

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
                    {meta.length > 0 && (
                      <p className="font-mono text-[11px] tracking-wide text-ink-faint uppercase">
                        {meta.join(" · ")}
                      </p>
                    )}
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

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
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
                <Label htmlFor="new-bullet-company">Company (optional)</Label>
                <Input
                  id="new-bullet-company"
                  value={newBulletCompany}
                  onChange={(event) => setNewBulletCompany(event.target.value)}
                  placeholder="e.g. Acme Inc."
                />
              </div>
              <div className="col-span-2 flex flex-col gap-1.5">
                <Label htmlFor="new-bullet-role">Role (optional)</Label>
                <Input
                  id="new-bullet-role"
                  value={newBulletRole}
                  onChange={(event) => setNewBulletRole(event.target.value)}
                  placeholder="e.g. Software Engineer"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-bullet-start">Start (optional)</Label>
                <Input
                  id="new-bullet-start"
                  type="month"
                  value={newBulletStartMonth}
                  onChange={(event) => setNewBulletStartMonth(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-bullet-end">End (optional)</Label>
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
            <Button onClick={addBullet} disabled={addingBullet || !newBulletText.trim()}>
              {addingBullet ? "Adding…" : "Add bullet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
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
