import { ChevronDown, Download } from "lucide-react";
import { APPLICATIONS_API as API_BASE } from "../../lib/api.js";
import { downloadFile } from "../../lib/downloadFile.js";
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
  const resumeDocx = `${API_BASE}/${applicationId}/export/resume.docx`;
  const resumePdf = `${API_BASE}/${applicationId}/export/resume.pdf`;
  const coverDocx = `${API_BASE}/${applicationId}/export/cover-letter.docx`;
  const coverPdf = `${API_BASE}/${applicationId}/export/cover-letter.pdf`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline">
          <Download className="size-4" /> Download
          <ChevronDown className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        {coverLetterRequested && <DropdownMenuLabel>Resume</DropdownMenuLabel>}
        <DropdownMenuItem onClick={() => downloadFile(resumeDocx, "resume.docx")}>Word (.docx)</DropdownMenuItem>
        <DropdownMenuItem onClick={() => downloadFile(resumePdf, "resume.pdf")}>PDF (.pdf)</DropdownMenuItem>
        {coverLetterRequested && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Cover letter</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => downloadFile(coverDocx, "cover-letter.docx")}>Word (.docx)</DropdownMenuItem>
            <DropdownMenuItem onClick={() => downloadFile(coverPdf, "cover-letter.pdf")}>PDF (.pdf)</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
