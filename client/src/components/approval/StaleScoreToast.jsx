import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "../Spinner.jsx";

// Content-only — positioning (fixed, stacking with any other active toast)
// lives in the shared ToastStack wrapper this renders inside of.
export function StaleScoreToast({ rechecking, busy, onRecheck }) {
  return (
    <div className="flex w-full max-w-sm items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 shadow-lg dark:border-blue-800 dark:bg-blue-950">
      <Info className="mt-0.5 size-5 shrink-0 text-blue-600 dark:text-blue-400" />
      <div className="flex-1">
        <p className="text-sm text-blue-900 dark:text-blue-200">
          You've made changes since your last check — the score and feedback below are stale.
        </p>
        <Button size="sm" className="mt-2" onClick={onRecheck} disabled={busy}>
          {rechecking ? (
            <>
              <Spinner className="size-4" /> Re-checking…
            </>
          ) : (
            "Re-check edited text"
          )}
        </Button>
      </div>
    </div>
  );
}
