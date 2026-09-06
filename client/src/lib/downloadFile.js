import { apiFetch } from "./apiFetch.js";

// A plain <a href> can't carry the Bearer token these export routes now
// require, so the file is fetched via apiFetch and saved from the resulting
// blob instead of navigating the browser directly to the URL.
export async function downloadFile(url, fallbackFilename) {
  const res = await apiFetch(url);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to download file.");
  }

  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") || "";
  const filename = disposition.match(/filename="([^"]+)"/)?.[1] || fallbackFilename;

  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(blobUrl);
}
