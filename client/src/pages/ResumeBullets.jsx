import { useEffect, useState } from "react";
import { RESUMES_API as API_BASE } from "../lib/api.js";
import "./ResumeBullets.css";

export default function ResumeBullets() {
  const [masterResumes, setMasterResumes] = useState([]);
  const [selectedResumeId, setSelectedResumeId] = useState("");
  const [bullets, setBullets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const [savingId, setSavingId] = useState(null);

  const [newBulletText, setNewBulletText] = useState("");
  const [addingBullet, setAddingBullet] = useState(false);

  useEffect(() => {
    async function loadResumes() {
      try {
        const res = await fetch(API_BASE);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Couldn't load your resumes.");
        setMasterResumes(data.masterResumes);
      } catch (err) {
        setError(err.message);
      }
    }
    loadResumes();
  }, []);

  useEffect(() => {
    if (!selectedResumeId) {
      setBullets([]);
      return;
    }

    async function loadBullets() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`${API_BASE}/${selectedResumeId}/bullets`);
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
  }, [selectedResumeId]);

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
    if (!newBulletText.trim() || !selectedResumeId) return;

    setAddingBullet(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/${selectedResumeId}/bullets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newBulletText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't add this bullet.");

      setBullets((prev) => [...prev, data.resumeBullet]);
      setNewBulletText("");
    } catch (err) {
      setError(err.message);
    } finally {
      setAddingBullet(false);
    }
  }

  return (
    <section className="rb-page">
      <p className="rb-eyebrow">Master resume</p>
      <h1 className="rb-title">Resume Bullets</h1>
      <p className="rb-lede">
        Every bullet here is a real line from something you uploaded — editing it here changes
        what gets pulled into every future tailored resume.
      </p>

      <div className="rb-field">
        <label htmlFor="resume-select" className="rb-label">
          Resume
        </label>
        <select
          id="resume-select"
          className="rb-select"
          value={selectedResumeId}
          onChange={(event) => setSelectedResumeId(event.target.value)}
        >
          <option value="">Select a resume…</option>
          {masterResumes.map((resume) => (
            <option key={resume._id} value={resume._id}>
              {resume.label}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="rb-alert" role="alert">{error}</p>}

      {loading && <p className="rb-status">Fetching this resume's bullets…</p>}

      {!loading && !selectedResumeId && !error && (
        <p className="rb-status">Select a resume above to see its bullets.</p>
      )}

      {!loading && selectedResumeId && bullets.length === 0 && !error && (
        <p className="rb-status">
          This resume has no bullets yet — add one below, or upload a file.
        </p>
      )}

      <ul className="rb-list">
        {bullets.map((bullet) => {
          const isEditing = editingId === bullet._id;
          const isSaving = savingId === bullet._id;
          const meta = [bullet.role, bullet.company, bullet.dateRange].filter(Boolean);

          return (
            <li key={bullet._id} className={`rb-bullet${isEditing ? " is-editing" : ""}`}>
              <span className="rb-bullet-strip" aria-hidden="true" />
              <div className="rb-bullet-body">
                {isEditing ? (
                  <>
                    <textarea
                      className="rb-textarea"
                      value={editingText}
                      onChange={(event) => setEditingText(event.target.value)}
                      rows={3}
                      autoFocus
                    />
                    <div className="rb-actions">
                      <button
                        type="button"
                        className="rb-btn rb-btn-primary"
                        onClick={() => saveEditing(bullet._id)}
                        disabled={isSaving}
                      >
                        {isSaving ? "Saving…" : "Save"}
                      </button>
                      <button
                        type="button"
                        className="rb-btn rb-btn-ghost"
                        onClick={cancelEditing}
                        disabled={isSaving}
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="rb-bullet-text">{bullet.text}</p>
                    {meta.length > 0 && <p className="rb-bullet-meta">{meta.join(" · ")}</p>}
                    {(bullet.canonicalSkills?.length > 0 || bullet.metrics?.length > 0) && (
                      <div className="rb-tags">
                        {bullet.canonicalSkills?.map((skill) => (
                          <span key={skill} className="rb-tag">
                            {skill}
                          </span>
                        ))}
                        {bullet.metrics?.map((metric) => (
                          <span key={metric} className="rb-tag rb-tag-metric">
                            {metric}
                          </span>
                        ))}
                      </div>
                    )}
                    <button
                      type="button"
                      className="rb-btn rb-btn-edit"
                      onClick={() => startEditing(bullet)}
                    >
                      Edit
                    </button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {selectedResumeId && !loading && (
        <div className="rb-add">
          <label htmlFor="new-bullet" className="rb-label">
            Add a bullet
          </label>
          <textarea
            id="new-bullet"
            className="rb-textarea"
            value={newBulletText}
            onChange={(event) => setNewBulletText(event.target.value)}
            rows={3}
            placeholder="Paste or write a new bullet…"
          />
          <div className="rb-actions">
            <button
              type="button"
              className="rb-btn rb-btn-primary"
              onClick={addBullet}
              disabled={addingBullet || !newBulletText.trim()}
            >
              {addingBullet ? "Adding…" : "Add bullet"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
