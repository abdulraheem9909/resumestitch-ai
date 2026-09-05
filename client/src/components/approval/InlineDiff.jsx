import { diffWords } from "diff";

// Git-style inline word diff: unchanged text renders plain, removed text is
// struck through in red, added text is highlighted in green. Used everywhere
// the Compare tab shows a master-resume value next to its tailored/approved
// counterpart (title, summary, bullets) — never used for scoring or gap
// analysis, purely a visual aid.
export function InlineDiff({ original, revised, emptyText = "—" }) {
  const before = original || "";
  const after = revised || "";

  if (!before && !after) {
    return <span className="text-muted-foreground">{emptyText}</span>;
  }

  // Common case: nothing changed. Skip jsdiff entirely rather than render a
  // single "unchanged" span wrapper for the whole string.
  if (before === after) {
    return <span>{after}</span>;
  }

  const parts = diffWords(before, after);

  return (
    <span>
      {parts.map((part, index) => {
        if (part.added) {
          return (
            <span
              key={index}
              className="rounded-sm bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-300"
            >
              {part.value}
            </span>
          );
        }
        if (part.removed) {
          return (
            <span
              key={index}
              className="rounded-sm bg-red-100 text-red-700 line-through dark:bg-red-500/20 dark:text-red-300"
            >
              {part.value}
            </span>
          );
        }
        return <span key={index}>{part.value}</span>;
      })}
    </span>
  );
}
