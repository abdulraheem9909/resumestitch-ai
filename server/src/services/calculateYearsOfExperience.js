const DATE_RANGE_PATTERN = /^(\d{2})\/(\d{4})\s*-\s*(?:(\d{2})\/(\d{4})|present)$/i;

function toMonthIndex(month, year) {
  return year * 12 + (month - 1);
}

function parseDateRange(dateRange, referenceMonthIndex) {
  const match = DATE_RANGE_PATTERN.exec((dateRange || '').trim());
  if (!match) {
    console.warn(`calculateYearsOfExperience: could not parse dateRange "${dateRange}" — skipping.`);
    return null;
  }

  const [, startMonth, startYear, endMonth, endYear] = match;
  const start = toMonthIndex(Number(startMonth), Number(startYear));
  const end = endMonth ? toMonthIndex(Number(endMonth), Number(endYear)) : referenceMonthIndex;

  if (end < start) {
    console.warn(`calculateYearsOfExperience: dateRange "${dateRange}" ends before it starts — skipping.`);
    return null;
  }

  return [start, end];
}

function mergeIntervals(intervals) {
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  const merged = [];

  for (const [start, end] of sorted) {
    const last = merged[merged.length - 1];
    if (last && start <= last[1]) {
      last[1] = Math.max(last[1], end);
    } else {
      merged.push([start, end]);
    }
  }

  return merged;
}

/**
 * Total years of professional experience, computed deterministically from
 * resumeBullets date ranges only (education is deliberately excluded — see
 * plan doc). Dedupes bullets sharing the same (role, company, dateRange) so
 * multiple bullets from one job don't multiply its duration, then merges
 * overlapping employment periods before summing.
 */
export function calculateYearsOfExperience(resumeBullets, referenceDate = new Date()) {
  const referenceMonthIndex = toMonthIndex(referenceDate.getMonth() + 1, referenceDate.getFullYear());

  const seen = new Set();
  const intervals = [];

  for (const bullet of resumeBullets || []) {
    const key = `${bullet.role || ''}|${bullet.company || ''}|${bullet.dateRange || ''}`.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const interval = parseDateRange(bullet.dateRange, referenceMonthIndex);
    if (interval) intervals.push(interval);
  }

  const merged = mergeIntervals(intervals);
  const totalMonths = merged.reduce((sum, [start, end]) => sum + (end - start + 1), 0);

  return Math.round((totalMonths / 12) * 10) / 10;
}
