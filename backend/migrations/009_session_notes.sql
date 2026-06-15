-- Add notes column to sessions table (fixes Mark Complete on teacher dashboard)
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS notes TEXT;
