import { supabase } from "@/integrations/supabase/client";

/**
 * Disponibilidade baseada em SLOTS FIXOS de 2 horas (horário de Lisboa):
 *  - 09:00, 11:00, 14:00, 16:00
 *
 * Cada funcionário pode ter no máximo MAX_PER_SLOT OT por slot.
 * A partir desse limite é considerado "ocupado" (overbooking).
 */
export const MAX_PER_SLOT = 1;

// Slots fixos disponíveis (hora local Europe/Lisbon)
export const WORK_ORDER_SLOTS = [9, 11, 14, 16, 19, 21, 23] as const;
export type SlotHour = (typeof WORK_ORDER_SLOTS)[number];

export const BLOCKING_STATUSES = [
  "pending",
  "approved",
  "in_progress",
  "awaiting_approval",
] as const;

export interface BusyAssignment {
  user_id: string;
  work_order_id: string;
  reference: string | null;
  title: string;
  scheduled_date: string;
}

export interface ScheduledWorkOrder {
  id: string;
  reference: string | null;
  title: string;
  scheduled_date: string;
  status: string;
  client_name?: string | null;
  assignees: { user_id: string; name: string }[];
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
export function getLisbonDateKey(date: Date): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Lisbon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(date); // YYYY-MM-DD
}

/**
 * Devolve o slot (9, 11, 14, 16) que melhor corresponde à hora dada.
 * Se a hora não cair exatamente num slot, escolhe o slot mais próximo
 * (cujo intervalo de 2h ocupado contém esta hora).
 */
export function getSlot(date: Date): SlotHour | null {
  const h = getLisbonHour(date);
  // Cada slot ocupa 2 horas: [slot, slot+2)
  for (const s of WORK_ORDER_SLOTS) {
    if (h >= s && h < s + 2) return s;
  }
  return null;
}

export function getSlotLabel(slot: SlotHour): string {
  return `${String(slot).padStart(2, "0")}:00`;
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
 * Devolve atribuições conflituosas: outras OTs do mesmo dia (Lisboa) e mesmo slot
 * cujo funcionário já tenha atingido o limite MAX_PER_SLOT.
 */
export async function getBusyEmployees(
  scheduledDate: Date,
  employeeIds?: string[],
  excludeWorkOrderId?: string
): Promise<BusyAssignment[]> {
  const targetDay = getLisbonDateKey(scheduledDate);
  const targetSlot = getSlot(scheduledDate);
  if (targetSlot === null) return [];
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

  // Filtrar para o mesmo dia + slot em Lisboa
  const sameSlot = (data as any[]).filter((row) => {
    const sd = row.work_orders?.scheduled_date;
    if (!sd) return false;
    const d = new Date(sd);
    return getLisbonDateKey(d) === targetDay && getSlot(d) === targetSlot;
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
    if (rows.length >= MAX_PER_SLOT) {
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
 * Conjunto de user_ids cujo limite de OTs no slot escolhido já foi atingido.
 */
export async function getBusyEmployeeIds(
  scheduledDate: Date,
  employeeIds?: string[],
  excludeWorkOrderId?: string
): Promise<Set<string>> {
  const busy = await getBusyEmployees(scheduledDate, employeeIds, excludeWorkOrderId);
  return new Set(busy.map((b) => b.user_id));
}

/**
 * Devolve as OTs agendadas (não canceladas/concluídas) entre [start, end].
 * Inclui assignees para mostrar no calendário.
 */
export async function getScheduledWorkOrders(
  start: Date,
  end: Date
): Promise<ScheduledWorkOrder[]> {
  const { data, error } = await supabase
    .from("work_orders")
    .select(
      `id, reference, title, scheduled_date, status,
       profiles:client_id ( name, company_name ),
       work_order_assignments ( user_id, profiles:user_id ( name ) )`
    )
    .gte("scheduled_date", start.toISOString())
    .lte("scheduled_date", end.toISOString())
    .in("status", [...BLOCKING_STATUSES])
    .order("scheduled_date", { ascending: true });

  if (error || !data) return [];

  return (data as any[]).map((row) => ({
    id: row.id,
    reference: row.reference,
    title: row.title,
    scheduled_date: row.scheduled_date,
    status: row.status,
    client_name: row.profiles?.company_name || row.profiles?.name || null,
    assignees: (row.work_order_assignments || []).map((a: any) => ({
      user_id: a.user_id,
      name: a.profiles?.name || "",
    })),
  }));
}
