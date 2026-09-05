// <input type="month"> gives "YYYY-MM" — every date range already on a
// resume (parsed from an upload, or a manually-added bullet/entry) uses
// "MM/YYYY", so convert to match rather than introduce a second format that
// would never group with anything.
export function formatMonthYear(value) {
  if (!value) return "";
  const [year, month] = value.split("-");
  if (!year || !month) return "";
  return `${month}/${year}`;
}

export function buildDateRange(startMonth, endMonth, isCurrent) {
  const start = formatMonthYear(startMonth);
  if (!start) return "";
  if (isCurrent) return `${start} - Present`;
  const end = formatMonthYear(endMonth);
  return end ? `${start} - ${end}` : start;
}

const MONTH_YEAR_PATTERN = /^(\d{2})\/(\d{4})$/;

// Reverses formatMonthYear() — "MM/YYYY" back to <input type="month">'s own
// "YYYY-MM". Anything else (a freeform date from a parsed resume, or empty)
// comes back as "" so the picker starts blank rather than showing garbage.
export function toMonthInputValue(monthYear) {
  const match = (monthYear || "").match(MONTH_YEAR_PATTERN);
  return match ? `${match[2]}-${match[1]}` : "";
}

// Reverses buildDateRange() for pre-filling the pickers when editing an
// existing entry. Only recognizes the exact "MM/YYYY", "MM/YYYY - MM/YYYY",
// and "MM/YYYY - Present" shapes buildDateRange() itself produces — a
// freeform date string from a real parsed resume (e.g. "Sep 2015 Jun 2020")
// simply comes back empty rather than guessed at, so the pickers start
// blank instead of showing something wrong.
export function parseDateRange(value) {
  const empty = { startMonth: "", endMonth: "", current: false };
  if (!value) return empty;

  const parts = value.split(" - ").map((part) => part.trim());
  if (parts.length === 1) {
    const startMonth = toMonthInputValue(parts[0]);
    return startMonth ? { startMonth, endMonth: "", current: false } : empty;
  }
  if (parts.length === 2) {
    const startMonth = toMonthInputValue(parts[0]);
    if (!startMonth) return empty;
    if (parts[1] === "Present") return { startMonth, endMonth: "", current: true };
    const endMonth = toMonthInputValue(parts[1]);
    return endMonth ? { startMonth, endMonth, current: false } : { startMonth, endMonth: "", current: false };
  }
  return empty;
}
