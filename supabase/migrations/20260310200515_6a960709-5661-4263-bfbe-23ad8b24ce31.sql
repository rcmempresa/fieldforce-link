
-- Remove manager and client access to maintenance reports
DROP POLICY IF EXISTS "Managers can manage all reports" ON public.maintenance_reports;
DROP POLICY IF EXISTS "Clients can view reports for own work orders" ON public.maintenance_reports;
