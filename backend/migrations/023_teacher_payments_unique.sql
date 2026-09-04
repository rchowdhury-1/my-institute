-- Prevent duplicate monthly payment rows for the same teacher. The app-level
-- pre-check in POST /payments/generate has a race window between the SELECT
-- and the INSERT; a real constraint closes it.
--
-- DROP IF EXISTS + ADD (not a bare ADD CONSTRAINT) so this is safe to re-run
-- — every migration file here runs on every deploy until it's recorded in
-- migrations_applied (see backend/src/db.js), and this one was first applied
-- manually against production outside that tracking table.
ALTER TABLE teacher_payments DROP CONSTRAINT IF EXISTS teacher_payments_teacher_month_year_key;
ALTER TABLE teacher_payments ADD CONSTRAINT teacher_payments_teacher_month_year_key
  UNIQUE (teacher_id, month, year);
