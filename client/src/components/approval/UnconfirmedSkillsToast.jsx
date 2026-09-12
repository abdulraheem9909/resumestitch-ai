import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

// Content-only (see ToastStack) — a lightweight, non-blocking nudge that
// UnconfirmedSkillMatchesCard exists and has something to review, since it's
// easy to miss scrolling past it inline on a long page. Deliberately NOT a
// blocking modal: this is an optional confidence-builder, not a required
// gate, and hand-editing + Re-checking repeatedly during review would mean
// a modal re-forcing itself on you over and over in the same session.
export function UnconfirmedSkillsToast({ count, onReview }) {
  return (
    <div className="flex w-full max-w-sm items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-lg dark:border-amber-800 dark:bg-amber-950">
      <Sparkles className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
      <div className="flex-1">
        <p className="text-sm text-amber-900 dark:text-amber-200">
          Found {count} skill{count === 1 ? "" : "s"} in your resume that {count === 1 ? "isn't" : "aren't"} a
          recognized match yet.
        </p>
        <Button size="sm" className="mt-2" onClick={onReview}>
          Review
        </Button>
      </div>
    </div>
  );
}
