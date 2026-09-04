// Purely a display swap for the plain "ATS score: N" badge — a filled radial
// arc out of 100. Doesn't touch how atsScore is computed, stored, or used in
// the retry conditional (server/src/services/atsScoreAndRecruiter.js);
// this only changes how the existing number is shown.
export function ScoreGauge({ score, label, size = 96 }) {
  if (score == null) return null;
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const strokeWidth = Math.max(4, Math.round(size * 0.09));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);
  const colorClass =
    clamped >= 70 ? "stroke-emerald-500" : clamped >= 50 ? "stroke-yellow-500" : "stroke-destructive";

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={strokeWidth}
            fill="none"
            className="stroke-muted"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={colorClass}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-semibold text-foreground">{clamped}</span>
        </div>
      </div>
      {label && <span className="text-center font-mono text-[10px] tracking-wide text-ink-faint uppercase">{label}</span>}
    </div>
  );
}
