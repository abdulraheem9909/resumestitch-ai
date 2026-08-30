import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { RESUMES_API as API_BASE } from "../lib/api.js";
import Breadcrumbs from "../components/Breadcrumbs.jsx";
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
import { Textarea } from "@/components/ui/textarea";

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
  const [addingBullet, setAddingBullet] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);

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

  async function addBullet() {
    if (!newBulletText.trim()) return;

    setAddingBullet(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/${id}/bullets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newBulletText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't add this bullet.");

      setBullets((prev) => [...prev, data.resumeBullet]);
      setNewBulletText("");
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
