import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RESUMES_API } from "../lib/api.js";
import "./MasterResumes.css";

export default function MasterResumes() {
  const [masterResumes, setMasterResumes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    async function loadResumes() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(RESUMES_API);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Couldn't load your resumes.");
        setMasterResumes(data.masterResumes);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadResumes();
  }, []);

  return (
    <section className="mr-page">
      <p className="mr-eyebrow">Master resumes</p>
      <h1 className="mr-title">Start an application</h1>
      <p className="mr-lede">Pick which resume you're applying with to move on to the job description.</p>

      {error && <p className="mr-alert" role="alert">{error}</p>}
      {loading && <p className="mr-status">Loading your resumes…</p>}

      {!loading && masterResumes.length === 0 && !error && (
        <p className="mr-status">You haven't uploaded a resume yet.</p>
      )}

      <div className="mr-grid">
        {masterResumes.map((resume) => (
          <button
            key={resume._id}
            type="button"
            className="mr-card"
            onClick={() => navigate(`/resumes/${resume._id}/apply`)}
          >
            <span className="mr-card-label">{resume.label}</span>
            <span className="mr-card-meta">
              Uploaded {new Date(resume.uploadedAt).toLocaleDateString()}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
