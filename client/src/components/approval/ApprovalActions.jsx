import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "../Spinner.jsx";

// Only ever rendered for a not-yet-approved application — the approved
// state (download links) lives in DownloadsCard instead, at the top of the
// sidebar. Caller (Approval.jsx) gates on application.status accordingly.
export function ApprovalActions({
  retryNotes,
  setRetryNotes,
  sendingRetry,
  approving,
  busy,
  onSendBack,
  onApprove,
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 md:p-5 shadow-card">
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
