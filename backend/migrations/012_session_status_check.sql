DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'sessions_status_check'
      AND table_name = 'sessions'
  ) THEN
    ALTER TABLE sessions
      ADD CONSTRAINT sessions_status_check
      CHECK (status IN ('scheduled', 'completed', 'cancelled', 'rescheduled', 'no_show'));
  END IF;
END $$;
