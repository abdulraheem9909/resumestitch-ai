import { Trash2 } from "lucide-react";
import Breadcrumbs from "../Breadcrumbs.jsx";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ApprovalHeader({
  application,
  discardDialogOpen,
  setDiscardDialogOpen,
  discardError,
  discarding,
  busy,
  onDiscard,
}) {
  const applicationLabel = application?.companyName
    ? [application.companyName, application.jobTitle].filter(Boolean).join(" — ")
    : "Review application";

  return (
    <>
      <div className="sticky top-0 z-10 bg-background pb-10 pt-7 md:pt-10 px-1 md:px-2">
        <Breadcrumbs
          backTo="/applications"
          trail={[
            { label: "Applications", to: "/applications" },
            { label: applicationLabel },
          ]}
        />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold text-foreground md:text-3xl">
              {applicationLabel}
            </h1>
            <p className="max-w-prose text-sm text-muted-foreground md:text-base">
              Nothing here is saved or exported until you approve it — hand-edit anything that
              doesn't sound like you, or send it back with notes for another pass.
            </p>
          </div>
          {application && (
            <Button
              size="sm"
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => setDiscardDialogOpen(true)}
              disabled={busy}
            >
              <Trash2 className="size-4" /> Discard
            </Button>
          )}
        </div>
      </div>

      <Dialog open={discardDialogOpen} onOpenChange={(open) => !open && setDiscardDialogOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard this application?</DialogTitle>
            <DialogDescription>
              This permanently deletes the JD, tailored resume, cover letter, and scoring history
              for {applicationLabel}. This can't be undone.
            </DialogDescription>
          </DialogHeader>

          {discardError && (
            <Alert variant="destructive">
              <AlertDescription>{discardError}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDiscardDialogOpen(false)} disabled={discarding}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={onDiscard} disabled={discarding}>
              {discarding ? "Discarding…" : "Discard permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
