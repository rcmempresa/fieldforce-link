import { supabase } from "@/integrations/supabase/client";

/**
 * Window in hours considered as a conflict around a scheduled time.
 * A scheduled time within ±BUSY_WINDOW_HOURS of another assigned WO counts as overbooking.
 */
export const BUSY_WINDOW_HOURS = 1;

/**
 * Statuses of work orders that "occupy" an employee for availability purposes.
 * cancelled and completed do NOT block the employee.
 */
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

/**
 * Returns the list of assignments (employees + work orders) that conflict
 * with `scheduledDate` within ±BUSY_WINDOW_HOURS, restricted to `employeeIds`
 * if provided. An assignment conflicts when its work order has a scheduled_date
 * within the window AND a blocking status.
 */
export async function getBusyEmployees(
  scheduledDate: Date,
  employeeIds?: string[],
  excludeWorkOrderId?: string
): Promise<BusyAssignment[]> {
  const start = new Date(scheduledDate.getTime() - BUSY_WINDOW_HOURS * 60 * 60 * 1000);
  const end = new Date(scheduledDate.getTime() + BUSY_WINDOW_HOURS * 60 * 60 * 1000);

  let query = supabase
    .from("work_order_assignments")
    .select(
      `user_id,
       work_order_id,
       work_orders!inner ( id, reference, title, scheduled_date, status )`
    )
    .gte("work_orders.scheduled_date", start.toISOString())
    .lte("work_orders.scheduled_date", end.toISOString())
    .in("work_orders.status", BLOCKING_STATUSES as unknown as string[]);

  if (employeeIds && employeeIds.length > 0) {
    query = query.in("user_id", employeeIds);
  }
  if (excludeWorkOrderId) {
    query = query.neq("work_order_id", excludeWorkOrderId);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row: any) => ({
    user_id: row.user_id,
    work_order_id: row.work_order_id,
    reference: row.work_orders?.reference ?? null,
    title: row.work_orders?.title ?? "",
    scheduled_date: row.work_orders?.scheduled_date ?? "",
  }));
}

/**
 * Returns the set of employee user_ids that are busy at `scheduledDate`.
 */
export async function getBusyEmployeeIds(
  scheduledDate: Date,
  employeeIds?: string[],
  excludeWorkOrderId?: string
): Promise<Set<string>> {
  const busy = await getBusyEmployees(scheduledDate, employeeIds, excludeWorkOrderId);
  return new Set(busy.map((b) => b.user_id));
}
