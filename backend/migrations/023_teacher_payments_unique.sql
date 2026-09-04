-- Prevent duplicate monthly payment rows for the same teacher. The app-level
-- pre-check in POST /payments/generate has a race window between the SELECT
-- and the INSERT; a real constraint closes it.
ALTER TABLE teacher_payments ADD CONSTRAINT teacher_payments_teacher_month_year_key
  UNIQUE (teacher_id, month, year);
