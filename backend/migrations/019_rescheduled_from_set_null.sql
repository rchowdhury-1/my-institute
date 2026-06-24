-- Change rescheduled_from FK to ON DELETE SET NULL.
-- The rescheduled_from linkage is informational (history tracking), not structural.
-- Setting to NULL on parent deletion means "original session removed, rescheduled session remains."
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_rescheduled_from_fkey;
ALTER TABLE sessions ADD CONSTRAINT sessions_rescheduled_from_fkey
  FOREIGN KEY (rescheduled_from) REFERENCES sessions(id) ON DELETE SET NULL;
