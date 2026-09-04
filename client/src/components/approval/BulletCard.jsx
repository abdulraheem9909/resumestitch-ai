import { Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function BulletCard({ bullet, original, verification, applicationStatus, editingState, bulletActions }) {
  const { editingBulletId, editingBulletText, setEditingBulletText, savingBulletId, bulletTextareaRef } = editingState;
  const { onToggleRejected, onStartEdit, onCancelEdit, onSaveBullet } = bulletActions;

  const isEditing = editingBulletId === bullet.bulletId;
  const isSaving = savingBulletId === bullet.bulletId;
  const flags = [
    ...(verification?.fabricatedSkills || []),
    ...(verification?.fabricatedMetrics || []),
  ];

  return (
    <li
      className={`rounded-lg border border-border bg-card p-5 shadow-card${bullet.rejected ? " opacity-60" : ""}`}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Original</p>
          <p className="text-sm text-foreground">{original?.text || "—"}</p>
        </div>
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <p className="text-xs font-medium text-muted-foreground">Tailored</p>
            <Badge variant="secondary">{bullet.editSource}</Badge>
            <Badge variant="outline">rephrase {Math.round((bullet.rephraseIntensity ?? 0) * 100)}%</Badge>
            {bullet.rejected && (
              <Badge variant="destructive">Out of context — excluded from export</Badge>
            )}
          </div>
          {applicationStatus !== "approved" && (
            <div className="mb-2 flex items-center gap-2">
              <Checkbox
                id={`exclude-${bullet.bulletId}`}
                checked={bullet.rejected}
                disabled={isSaving}
                onCheckedChange={(checked) =>
                  onToggleRejected(bullet.bulletId, checked === true)
                }
              />
              <Label
                htmlFor={`exclude-${bullet.bulletId}`}
                className="text-xs font-normal text-muted-foreground"
              >
                Exclude from resume (out of context)
              </Label>
            </div>
          )}
          {isEditing ? (
            <>
              <Textarea
                ref={bulletTextareaRef}
                value={editingBulletText}
                onChange={(event) => setEditingBulletText(event.target.value)}
                rows={3}
              />
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={() => onSaveBullet(bullet.bulletId)} disabled={isSaving}>
                  {isSaving ? "Saving…" : "Save"}
                </Button>
                <Button size="sm" variant="ghost" onClick={onCancelEdit} disabled={isSaving}>
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-foreground">{bullet.finalText}</p>
              {applicationStatus !== "approved" && !bullet.rejected && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-2 w-fit"
                  onClick={() => onStartEdit(bullet)}
                >
                  <Pencil className="size-4" />
                  Edit
                </Button>
              )}
            </>
          )}
        </div>
      </div>
      {flags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {flags.map((flag) => (
            <Badge key={flag} variant="destructive" className="max-w-full min-w-0 shrink flex-wrap whitespace-normal break-words">
              {flag}
            </Badge>
          ))}
        </div>
      )}
    </li>
  );
}
