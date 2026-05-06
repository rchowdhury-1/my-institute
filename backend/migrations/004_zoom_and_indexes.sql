-- Migration 004: Zoom links, subject on sessions, student payments, package management, performance indexes

-- Add subject to sessions (to unify with lessons table)
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS subject TEXT
  DEFAULT 'quran' CHECK (subject IN ('quran', 'arabic', 'islamic_studies'));

-- Add zoom link to sessions
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS zoom_link TEXT;

-- Student payments — for logging what students have paid
CREATE TABLE IF NOT EXISTS student_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GBP',
  payment_method TEXT,
  notes TEXT,
  logged_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance indexes on high-traffic foreign key columns
CREATE INDEX IF NOT EXISTS idx_sessions_student_id      ON sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_sessions_teacher_id      ON sessions(teacher_id);
CREATE INDEX IF NOT EXISTS idx_sessions_scheduled_at    ON sessions(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_sessions_status          ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_homework_student_id      ON homework(student_id);
CREATE INDEX IF NOT EXISTS idx_homework_teacher_id      ON homework(teacher_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id    ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read       ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id   ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_packages_user_id         ON packages(user_id);
CREATE INDEX IF NOT EXISTS idx_lessons_student_id       ON lessons(student_id);
CREATE INDEX IF NOT EXISTS idx_lessons_teacher_id       ON lessons(teacher_id);
CREATE INDEX IF NOT EXISTS idx_student_payments_student ON student_payments(student_id);
