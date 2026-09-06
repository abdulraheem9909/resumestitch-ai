// Drop-in replacement for the raw `fetch()` calls used across this app: adds
// the stored auth token, and clears it + redirects to /login on a 401 —
// returns a plain Response so every existing call site's `await res.json()`/
// `if (!res.ok)` logic is untouched.
export async function apiFetch(url, options = {}) {
  const token = localStorage.getItem("token");
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    localStorage.removeItem("token");
    window.location.assign("/login");
  }
  return res;
}
