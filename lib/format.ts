// Dates and times are always shown in Lagos time (WAT), whatever the device's setting.

const TIME_ZONE = "Africa/Lagos";

export function formatDateTime(value: string | Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

// e.g. "just now", "40 min ago", "3 h ago", "yesterday", "4 days ago"
export function timeAgo(value: string | Date): string {
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

// e.g. "Tuesday, 3 November"
export function longDate(value: Date): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, weekday: "long", day: "numeric", month: "long" }).format(value);
}

// "Good morning" / "Good afternoon" / "Good evening", by the hour in Lagos.
export function greeting(value: Date): string {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "numeric", hour12: false }).format(value));
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
