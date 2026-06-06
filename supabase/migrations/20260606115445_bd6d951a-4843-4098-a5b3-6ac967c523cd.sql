CREATE UNIQUE INDEX IF NOT EXISTS time_entries_one_active_per_user_wo
ON public.time_entries (user_id, work_order_id)
WHERE end_time IS NULL;