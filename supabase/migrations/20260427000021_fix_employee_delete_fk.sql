-- Change upload_log FK from NO ACTION to SET NULL so employees can be deleted
-- while preserving the upload history.

ALTER TABLE public.upload_log
  DROP CONSTRAINT upload_log_employee_id_fkey;

ALTER TABLE public.upload_log
  ADD CONSTRAINT upload_log_employee_id_fkey
  FOREIGN KEY (employee_id) REFERENCES public.employees(id)
  ON DELETE SET NULL;
