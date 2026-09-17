import { Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function TailoredSummaryCard({
  application,
  originalSummary,
  editingSummary,
  editingSummaryText,
  setEditingSummaryText,
  savingSummary,
  summaryTextareaRef,
  onStartEdit,
  onSave,
  onCancel,
}) {
  return (
    <div className="mb-4 md:mb-6 rounded-lg border border-border bg-card p-4 md:p-5 shadow-card">
      <h3 className="mb-3 font-display text-lg font-semibold text-foreground">Summary</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Original</p>
          <p className="text-sm text-foreground">{originalSummary || "—"}</p>
        </div>
        <div>
          <div className="mb-1 flex items-center gap-2">
            <p className="text-xs font-medium text-muted-foreground">Tailored</p>
            {application.tailoredSummary?.editSource && (
              <Badge variant="secondary">{application.tailoredSummary.editSource}</Badge>
            )}
          </div>
          {editingSummary ? (
            <>
              <Textarea
                ref={summaryTextareaRef}
                value={editingSummaryText}
                onChange={(event) => setEditingSummaryText(event.target.value)}
                rows={4}
              />
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={onSave} disabled={savingSummary}>
                  {savingSummary ? "Saving…" : "Save"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onCancel}
                  disabled={savingSummary}
                >
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-foreground">{application.tailoredSummary?.finalText}</p>
              {application.status !== "approved" && (
                <Button size="sm" variant="ghost" className="mt-2 w-fit" onClick={onStartEdit}>
                  <Pencil className="size-4" />
                  Edit
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
