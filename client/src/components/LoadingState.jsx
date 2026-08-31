import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { HourglassLoader } from "./HourglassLoader.jsx";
import { Spinner } from "./Spinner.jsx";
import { cn } from "@/lib/utils";

const STEP_INTERVAL_MS = 3500;

// A page-level "this is taking a moment" block. Two shapes:
// - message only: a simple centered spinner + text, for quick data fetches.
// - message + steps: an animated step checklist that advances on a timer.
//   This isn't real backend progress (a single LLM pipeline call gives no
//   progress signal) — it's just enough motion and structure to make a long
//   wait feel alive and informative instead of a static wall of text.
export function LoadingState({ message = "Loading…", steps, className }) {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    if (!steps || steps.length === 0) return;
    setActiveStep(0);
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev < steps.length - 1 ? prev + 1 : prev));
    }, STEP_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [steps]);

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-5 rounded-lg border border-border bg-card px-6 py-12 text-center shadow-card",
        className
      )}
    >
      <HourglassLoader className="size-20" />

      <p className="max-w-sm text-sm text-muted-foreground">{message}</p>

      {steps && steps.length > 0 && (
        <ul className="flex w-full max-w-xs flex-col gap-2 text-left">
          {steps.map((step, index) => {
            const isDone = index < activeStep;
            const isActive = index === activeStep;
            return (
              <li
                key={step}
                className={cn(
                  "flex items-center gap-2.5 text-sm transition-colors duration-300",
                  (isDone || isActive) ? "text-foreground" : "text-muted-foreground/60"
                )}
              >
                {isDone ? (
                  <Check className="size-4 shrink-0 text-primary" />
                ) : isActive ? (
                  <Spinner className="size-4 shrink-0 text-primary" />
                ) : (
                  <span className="size-4 shrink-0 rounded-full border border-border" />
                )}
                {step}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
