// Days a work order has been open, counted in calendar days (local time)
// from its creation date until today. Used to show "Há X dias" on OT cards.

/** Calendar days elapsed since the given ISO date until `now` (default: today). */
export function daysOpen(createdAt: string | null | undefined, now: Date = new Date()): number {
  if (!createdAt) return 0;
  const created = new Date(createdAt);
  if (isNaN(created.getTime())) return 0;
  const start = new Date(created.getFullYear(), created.getMonth(), created.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
}

/** Label for the badge: "Aberta hoje", "Há 1 dia", "Há 5 dias". */
export function daysOpenLabel(createdAt: string | null | undefined, now?: Date): string {
  const days = daysOpen(createdAt, now);
  if (days === 0) return "Aberta hoje";
  if (days === 1) return "Há 1 dia";
  return `Há ${days} dias`;
}

/** True when the OT is still open (days counter is meaningful). */
export function isOpenStatus(status: string | null | undefined): boolean {
  return status !== "completed" && status !== "cancelled" && status !== "invoiced";
}

/** Tailwind classes for the badge by age: amber from 7 days, red from 14. */
export function daysOpenBadgeClass(createdAt: string | null | undefined, now?: Date): string {
  const days = daysOpen(createdAt, now);
  if (days >= 14) return "bg-destructive/10 text-destructive border border-destructive/30";
  if (days >= 7) return "bg-amber-500/15 text-amber-600 border border-amber-500/30";
  return "bg-muted text-muted-foreground border border-border";
}
