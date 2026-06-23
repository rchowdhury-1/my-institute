-- Migration 014: Weekly recurring schedules
-- No UNIQUE constraint on (student_id, teacher_id) — multiple schedules per pair allowed

CREATE TABLE IF NOT EXISTS weekly_schedules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  teacher_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject         TEXT NOT NULL DEFAULT 'quran',
  default_duration INTEGER NOT NULL DEFAULT 60,
  slots           JSONB NOT NULL DEFAULT '[]',
  lessons_remaining INTEGER,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ws_student ON weekly_schedules(student_id);
CREATE INDEX IF NOT EXISTS idx_ws_teacher ON weekly_schedules(teacher_id);
CREATE INDEX IF NOT EXISTS idx_ws_active ON weekly_schedules(is_active) WHERE is_active = true;
