-- Create enum for work order service type
CREATE TYPE work_order_service_type AS ENUM ('repair', 'maintenance', 'installation', 'warranty');

-- Add service_type column to work_orders table
ALTER TABLE work_orders ADD COLUMN service_type work_order_service_type NOT NULL DEFAULT 'repair';