-- Add address field to work_orders table
ALTER TABLE public.work_orders 
ADD COLUMN address text;