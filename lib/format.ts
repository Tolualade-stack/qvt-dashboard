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
