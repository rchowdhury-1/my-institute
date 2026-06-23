-- Migration 015: Link sessions to schedules + attendance tracking

-- Link sessions to the schedule that generated them
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS schedule_id UUID REFERENCES weekly_schedules(id) ON DELETE SET NULL;

-- Attendance tracking columns
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS teacher_attended BOOLEAN;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS student_attended BOOLEAN;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS attendance_marked_at TIMESTAMPTZ;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS attendance_marked_by UUID REFERENCES users(id);

-- Update status constraint to allow 'cancelled_teacher'
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_status_check;
ALTER TABLE sessions ADD CONSTRAINT sessions_status_check
  CHECK (status IN ('scheduled', 'completed', 'cancelled', 'rescheduled', 'no_show', 'cancelled_teacher'));

-- Index for schedule-based lookups
CREATE INDEX IF NOT EXISTS idx_sessions_schedule ON sessions(schedule_id) WHERE schedule_id IS NOT NULL;
