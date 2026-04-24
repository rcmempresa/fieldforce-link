import { supabase } from "@/integrations/supabase/client";

/**
 * Disponibilidade baseada em TURNOS (horário de Lisboa):
 *  - Manhã: 00:00 - 12:59 (Europe/Lisbon)
 *  - Tarde: 13:00 - 23:59 (Europe/Lisbon)
 *
 * Cada funcionário pode ter no máximo MAX_PER_SHIFT OTs por turno.
 * A partir desse limite é considerado "ocupado" (overbooking).
 */
export const MAX_PER_SHIFT = 2;

export const BLOCKING_STATUSES = [
  "pending",
  "approved",
  "in_progress",
  "awaiting_approval",
] as const;

export type Shift = "morning" | "afternoon";

export interface BusyAssignment {
  user_id: string;
  work_order_id: string;
  reference: string | null;
  title: string;
  scheduled_date: string;
}

/**
 * Devolve a hora (0-23) no fuso Europe/Lisbon para uma data UTC.
 */
function getLisbonHour(date: Date): number {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Lisbon",
    hour: "2-digit",
    hour12: false,
  });
  return parseInt(fmt.format(date), 10);
}

/**
 * Devolve a data (YYYY-MM-DD) no fuso Europe/Lisbon.
 */
function getLisbonDateKey(date: Date): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Lisbon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(date); // YYYY-MM-DD
}

export function getShift(date: Date): Shift {
  return getLisbonHour(date) < 13 ? "morning" : "afternoon";
}

export function getShiftLabel(shift: Shift): string {
  return shift === "morning" ? "Manhã" : "Tarde";
}

/**
 * Janela [start, end) que cobre o dia (Europe/Lisbon) de `date`.
 * Para simplicidade pegamos numa janela larga em UTC (±14h) e filtramos depois.
 */
function getDayBounds(date: Date): { start: Date; end: Date } {
  const start = new Date(date.getTime() - 24 * 60 * 60 * 1000);
  const end = new Date(date.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

/**
 * Devolve atribuições conflituosas: outras OTs do mesmo dia (Lisboa) e mesmo turno
 * cujo funcionário já tenha atingido o limite MAX_PER_SHIFT.
 */
export async function getBusyEmployees(
  scheduledDate: Date,
  employeeIds?: string[],
  excludeWorkOrderId?: string
): Promise<BusyAssignment[]> {
  const targetDay = getLisbonDateKey(scheduledDate);
  const targetShift = getShift(scheduledDate);
  const { start, end } = getDayBounds(scheduledDate);

  let query = supabase
    .from("work_order_assignments")
    .select(
      `user_id,
       work_order_id,
       work_orders!inner ( id, reference, title, scheduled_date, status )`
    )
    .gte("work_orders.scheduled_date", start.toISOString())
    .lte("work_orders.scheduled_date", end.toISOString())
    .in("work_orders.status", [...BLOCKING_STATUSES]);

  if (employeeIds && employeeIds.length > 0) {
    query = query.in("user_id", employeeIds);
  }
  if (excludeWorkOrderId) {
    query = query.neq("work_order_id", excludeWorkOrderId);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  // Filtrar para o mesmo dia + turno em Lisboa
  const sameSlot = (data as any[]).filter((row) => {
    const sd = row.work_orders?.scheduled_date;
    if (!sd) return false;
    const d = new Date(sd);
    return getLisbonDateKey(d) === targetDay && getShift(d) === targetShift;
  });

  // Contar por funcionário
  const counts = new Map<string, any[]>();
  for (const row of sameSlot) {
    const list = counts.get(row.user_id) ?? [];
    list.push(row);
    counts.set(row.user_id, list);
  }

  const busy: BusyAssignment[] = [];
  for (const [, rows] of counts) {
    if (rows.length >= MAX_PER_SHIFT) {
      for (const row of rows) {
        busy.push({
          user_id: row.user_id,
          work_order_id: row.work_order_id,
          reference: row.work_orders?.reference ?? null,
          title: row.work_orders?.title ?? "",
          scheduled_date: row.work_orders?.scheduled_date ?? "",
        });
      }
    }
  }

  return busy;
}

/**
 * Conjunto de user_ids cujo limite de OTs no turno escolhido já foi atingido.
 */
export async function getBusyEmployeeIds(
  scheduledDate: Date,
  employeeIds?: string[],
  excludeWorkOrderId?: string
): Promise<Set<string>> {
  const busy = await getBusyEmployees(scheduledDate, employeeIds, excludeWorkOrderId);
  return new Set(busy.map((b) => b.user_id));
}
