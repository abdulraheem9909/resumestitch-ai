import { Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function TailoredTitleCard({
  application,
  masterResume,
  titleSeniorityWarning,
  editingTitle,
  editingTitleText,
  setEditingTitleText,
  savingTitle,
  onStartEdit,
  onSave,
  onCancel,
}) {
  return (
    <div className="mb-6 rounded-lg border border-border bg-card p-5 shadow-card">
      <h3 className="mb-3 font-display text-lg font-semibold text-foreground">Title</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Original</p>
          <p className="text-sm text-foreground">{masterResume?.personalInfo?.title || "No title set"}</p>
        </div>
        <div>
          <div className="mb-1 flex items-center gap-2">
            <p className="text-xs font-medium text-muted-foreground">Tailored</p>
            {application.tailoredTitle?.editSource && (
              <Badge variant="secondary">{application.tailoredTitle.editSource}</Badge>
            )}
          </div>
          {editingTitle ? (
            <>
              <Input
                value={editingTitleText}
                onChange={(event) => setEditingTitleText(event.target.value)}
              />
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={onSave} disabled={savingTitle}>
                  {savingTitle ? "Saving…" : "Save"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onCancel}
                  disabled={savingTitle}
                >
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-foreground">{application.tailoredTitle?.finalText}</p>
              {titleSeniorityWarning.length > 0 && (
                <p className="mt-1 text-xs text-yellow-700 dark:text-yellow-400">
                  Contains {titleSeniorityWarning.map((term) => `"${term}"`).join(", ")} — your resume
                  doesn't show that level of seniority.
                </p>
              )}
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
