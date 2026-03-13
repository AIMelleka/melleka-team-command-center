import { format, formatDistanceToNow } from "date-fns";

export function safeFormatDate(
  dateStr: string | null | undefined,
  fmt: string,
  fallback = "—"
): string {
  if (!dateStr) return fallback;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return fallback;
    return format(d, fmt);
  } catch {
    return fallback;
  }
}

export function safeFormatDistance(
  dateStr: string | null | undefined,
  options?: { addSuffix?: boolean },
  fallback = "Unknown"
): string {
  if (!dateStr) return fallback;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return fallback;
    return formatDistanceToNow(d, options);
  } catch {
    return fallback;
  }
}
