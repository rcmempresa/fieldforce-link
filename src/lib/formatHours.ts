/**
 * Formats hours in a human-readable way.
 * Shows minutes if less than 1 hour, otherwise shows hours with 1 decimal.
 * @param hours - The number of hours (can be fractional)
 * @returns Formatted string like "45 min" or "2.5h"
 */
export function formatHours(hours: number | null | undefined): string {
  if (hours === null || hours === undefined || hours === 0) {
    return "0 min";
  }

  const totalMinutes = Math.round(hours * 60);

  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  // For 1 hour or more, show in hours with 1 decimal
  const roundedHours = Math.round(hours * 10) / 10;
  return `${roundedHours}h`;
}

/**
 * Formats hours with full precision for detailed views.
 * Shows hours and minutes like "2h 30min" or just "45 min"
 * @param hours - The number of hours (can be fractional)
 * @returns Formatted string like "2h 30min" or "45 min"
 */
export function formatHoursDetailed(hours: number | null | undefined): string {
  if (hours === null || hours === undefined || hours === 0) {
    return "0 min";
  }

  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;

  if (h === 0) {
    return `${m} min`;
  }

  if (m === 0) {
    return `${h}h`;
  }

  return `${h}h ${m}min`;
}
