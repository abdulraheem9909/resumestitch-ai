import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Same red/amber split as the retry policy's own named flags (server/src/
// services/atsScoreAndRecruiter.js): unsupportedClaim is the one flag that
// blocks approval on its own (a fabrication risk), so it stays visually
// distinct from the other three, which are all "worth a look" rather than
// "something's wrong." Reuses the same yellow tone SkillsCard's
// skillBadgeClassName already uses for "partial match," rather than
// inventing a second amber.
function flagBadgeClassName(flag) {
  if (flag === "unsupportedClaim") {
    return "";
  }
  return "border-transparent bg-yellow-100 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-400";
}

export function FlagBadge({ flag, muted = false }) {
  const isUnsupported = flag === "unsupportedClaim";
  return (
    <Badge
      variant={muted ? "outline" : isUnsupported ? "destructive" : "secondary"}
      className={cn(
        "max-w-full min-w-0 shrink flex-wrap whitespace-normal break-words",
        muted
          ? isUnsupported
            ? "border-destructive/40 text-destructive"
            : "border-yellow-500/40 text-yellow-700 dark:text-yellow-400"
          : flagBadgeClassName(flag)
      )}
    >
      {flag}
    </Badge>
  );
}
