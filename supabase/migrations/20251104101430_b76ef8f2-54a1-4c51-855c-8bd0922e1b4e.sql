-- Add new status for work orders awaiting manager approval
ALTER TYPE work_order_status ADD VALUE IF NOT EXISTS 'awaiting_approval';

-- Add comment to clarify the workflow
COMMENT ON TYPE work_order_status IS 'Work order statuses: awaiting_approval (client created, waiting manager approval), pending (approved by manager), in_progress, completed, cancelled';