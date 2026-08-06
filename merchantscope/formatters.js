export function safeDateLabel(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "Invalid/unavailable";
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) return "Invalid/unavailable";
  try { return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(parsed); }
  catch { return "Invalid/unavailable"; }
}

// Same convention as safeDateLabel (en-GB, Intl.DateTimeFormat, defensive
// fallback) but for a full ISO timestamp where time-of-day matters — e.g.
// distinguishing same-day history entries — rather than a bare filing date.
export function safeDateTimeLabel(value) {
  if (typeof value !== "string") return "Invalid/unavailable";
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.valueOf())) return "Invalid/unavailable";
  try { return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(parsed); }
  catch { return "Invalid/unavailable"; }
}
