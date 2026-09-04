import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// A small round info icon that reveals `text` on hover/focus — for the
// handful of spots on this page a first-time user would otherwise have no
// way to decode (an ATS score with no explanation, camelCase flag names, a
// "rephrase %" badge, etc.). Deliberately not used everywhere — a page
// covered in info icons is as unhelpful as a page with none.
export function InfoTooltip({ text }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex shrink-0 text-muted-foreground hover:text-foreground"
          aria-label="More info"
        >
          <Info className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  );
}
