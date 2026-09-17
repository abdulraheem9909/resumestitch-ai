import { HourglassLoader } from "./HourglassLoader.jsx";

// Full-screen backdrop shown while a file download is in flight. Export
// routes build the .docx/.pdf/.xlsx fresh on every request (LibreOffice
// headless conversion for PDFs, plus a cold-start-prone free host), so this
// can take noticeably longer than a typical instant download — without
// this, a slow request just looks like a dead click.
export function DownloadOverlay({ message = "Preparing your download…" }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background/80 backdrop-blur-sm"
    >
      <HourglassLoader className="size-20" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
