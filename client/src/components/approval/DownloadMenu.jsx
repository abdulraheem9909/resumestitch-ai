import { useState } from "react";
import { ChevronDown, Download } from "lucide-react";
import { APPLICATIONS_API as API_BASE } from "../../lib/api.js";
import { downloadFile } from "../../lib/downloadFile.js";
import { DownloadOverlay } from "../DownloadOverlay.jsx";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// One button, one menu — replaces what used to be two separate "Download
// resume"/"Download cover letter" dropdown buttons sitting side by side.
// When a cover letter was requested, the menu groups the two documents under
// their own labels with a separator; otherwise it's just the plain
// Word/PDF pair. Same export routes as before
// (GET /:id/export/resume.docx|pdf, cover-letter.docx|pdf), gated on
// approval by the caller (ApprovalHeader). Fetched via downloadFile rather
// than a plain <a href> — these routes now require the Bearer token a raw
// link navigation can't carry.
export function DownloadMenu({ applicationId, coverLetterRequested }) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  const resumeDocx = `${API_BASE}/${applicationId}/export/resume.docx`;
  const resumePdf = `${API_BASE}/${applicationId}/export/resume.pdf`;
  const coverDocx = `${API_BASE}/${applicationId}/export/cover-letter.docx`;
  const coverPdf = `${API_BASE}/${applicationId}/export/cover-letter.pdf`;

  // The export routes build the file fresh on every request (LibreOffice
  // conversion for a PDF), so this can take a few seconds — the overlay
  // and disabled trigger are the only signal a click actually registered.
  async function handleDownload(url, filename) {
    setError("");
    setDownloading(true);
    try {
      await downloadFile(url, filename);
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="relative">
      {downloading && <DownloadOverlay />}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" disabled={downloading}>
            <Download className="size-4" /> Download
            <ChevronDown className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          {coverLetterRequested && <DropdownMenuLabel>Resume</DropdownMenuLabel>}
          <DropdownMenuItem disabled={downloading} onClick={() => handleDownload(resumeDocx, "resume.docx")}>
            Word (.docx)
          </DropdownMenuItem>
          <DropdownMenuItem disabled={downloading} onClick={() => handleDownload(resumePdf, "resume.pdf")}>
            PDF (.pdf)
          </DropdownMenuItem>
          {coverLetterRequested && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Cover letter</DropdownMenuLabel>
              <DropdownMenuItem disabled={downloading} onClick={() => handleDownload(coverDocx, "cover-letter.docx")}>
                Word (.docx)
              </DropdownMenuItem>
              <DropdownMenuItem disabled={downloading} onClick={() => handleDownload(coverPdf, "cover-letter.pdf")}>
                PDF (.pdf)
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {error && <p className="absolute top-full right-0 mt-1 w-56 text-right text-xs text-destructive">{error}</p>}
    </div>
  );
}
