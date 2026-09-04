import { Download } from "lucide-react";
import { APPLICATIONS_API as API_BASE } from "@/lib/api.js";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "../Spinner.jsx";

export function ApprovalActions({
  application,
  applicationId,
  retryNotes,
  setRetryNotes,
  sendingRetry,
  approving,
  busy,
  onSendBack,
  onApprove,
}) {
  if (application.status === "approved") {
    return (
      <div className="flex flex-col gap-3">
        <Alert>
          <AlertDescription>
            Approved{application.approvedAt ? ` on ${new Date(application.approvedAt).toLocaleString()}` : ""}.
          </AlertDescription>
        </Alert>
        <div className="flex flex-wrap gap-2">
          <a href={`${API_BASE}/${applicationId}/export/resume.docx`}>
            <Button size="sm" variant="outline">
              <Download className="size-4" /> Download resume (.docx)
            </Button>
          </a>
          <a href={`${API_BASE}/${applicationId}/export/resume.pdf`}>
            <Button size="sm" variant="outline">
              <Download className="size-4" /> Download resume (.pdf)
            </Button>
          </a>
          {application.coverLetterRequested && (
            <>
              <a href={`${API_BASE}/${applicationId}/export/cover-letter.docx`}>
                <Button size="sm" variant="outline">
                  <Download className="size-4" /> Download cover letter (.docx)
                </Button>
              </a>
              <a href={`${API_BASE}/${applicationId}/export/cover-letter.pdf`}>
                <Button size="sm" variant="outline">
                  <Download className="size-4" /> Download cover letter (.pdf)
                </Button>
              </a>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-card">
      <p className="mb-2 text-xs font-medium text-muted-foreground">Send back with notes</p>
      <Textarea
        value={retryNotes}
        onChange={(event) => setRetryNotes(event.target.value)}
        rows={3}
        placeholder="What should change on the next pass?"
      />
      <div className="mt-3 flex gap-2">
        <Button
          variant="outline"
          onClick={onSendBack}
          disabled={busy || !retryNotes.trim()}
        >
          {sendingRetry ? (
            <>
              <Spinner className="size-4" /> Sending…
            </>
          ) : (
            "Send back with notes"
          )}
        </Button>
        <Button onClick={onApprove} disabled={busy}>
          {approving ? "Approving…" : "Approve"}
        </Button>
      </div>
      {sendingRetry && (
        <p className="mt-2 text-xs text-muted-foreground">
          Re-tailoring and re-scoring against your notes — this can take up to a minute…
        </p>
      )}
    </div>
  );
}
