export type UnavailabilityReason = "ferias" | "baixa" | "folga" | "feriado" | "outro";

export interface Unavailability {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  reason: UnavailabilityReason;
  notes: string | null;
}

export const UNAVAILABILITY_REASONS: { value: UnavailabilityReason; label: string; phrase: string; icon: string }[] = [
  { value: "ferias", label: "Férias", phrase: "em férias", icon: "🏖️" },
  { value: "baixa", label: "Baixa médica", phrase: "de baixa médica", icon: "🏥" },
  { value: "folga", label: "Folga", phrase: "de folga", icon: "🛌" },
  { value: "feriado", label: "Feriado", phrase: "de feriado", icon: "📅" },
  { value: "outro", label: "Outro", phrase: "indisponível", icon: "⛔" },
];

export const reasonInfo = (r: string) =>
  UNAVAILABILITY_REASONS.find((x) => x.value === r) ?? UNAVAILABILITY_REASONS[4];

/** Local YYYY-MM-DD for a Date or a datetime-local string. */
export const toDay = (d: Date | string) => {
  if (typeof d === "string") return d.slice(0, 10);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** First block covering `day` (inclusive range) for the user, if any. */
export const findBlock = (list: Unavailability[], userId: string, day: string) =>
  list.find((u) => u.user_id === userId && u.start_date <= day && u.end_date >= day);
