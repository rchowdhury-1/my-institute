-- Phase 2: Sessions, Homework, Messages, Notifications

-- Add supervisor role
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('student', 'teacher', 'admin', 'supervisor'));

-- Extend packages
ALTER TABLE packages ADD COLUMN IF NOT EXISTS sessions_remaining INTEGER;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS renewal_reminder_sent BOOLEAN NOT NULL DEFAULT false;

-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'completed', 'cancelled', 'rescheduled')),
  cancellation_reason TEXT,
  rescheduled_from UUID REFERENCES sessions(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Homework
CREATE TABLE IF NOT EXISTS homework (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  file_url TEXT,
  due_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'assigned'
    CHECK (status IN ('assigned', 'submitted', 'graded')),
  grade VARCHAR(50),
  teacher_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Homework submissions
CREATE TABLE IF NOT EXISTS homework_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  homework_id UUID NOT NULL REFERENCES homework(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_url TEXT,
  notes TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
