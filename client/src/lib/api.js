// Falls back to localhost for local dev; set VITE_API_URL at build time to
// point a deployed frontend at its deployed backend (no trailing slash).
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export const RESUMES_API = `${API_BASE_URL}/api/resumes`;
export const APPLICATIONS_API = `${API_BASE_URL}/api/applications`;
export const OUTREACH_API = `${API_BASE_URL}/api/outreach`;
export const AUTH_API = `${API_BASE_URL}/api/auth`;
