-- My Institute — migration 005: user profiles, pricing, password management, rate snapshots

-- ── Users: soft-delete ───────────────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- ── Users: teacher profile fields ────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS specialisation TEXT;

-- ── Users: student-specific fields ───────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS guardian_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS teacher_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- ── Users: per-student pricing (NULL for non-students) ───────────────────────
-- DECIMAL not FLOAT — money must never be stored as floating point
ALTER TABLE users ADD COLUMN IF NOT EXISTS hourly_rate DECIMAL(10,2);
ALTER TABLE users ADD COLUMN IF NOT EXISTS currency CHAR(3) NOT NULL DEFAULT 'GBP';
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_legacy_pricing BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pricing_notes TEXT;

-- ── Users: forced password change on first login ──────────────────────────────
-- Set to true for all admin-provisioned accounts; flipped to false on first login password change
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;

-- ── Sessions: rate snapshot at creation ──────────────────────────────────────
-- Records the student's hourly rate at the moment each session is created.
-- Changes to a student's rate later do NOT retroactively affect existing sessions.
-- NULL for sessions created before this migration (rate unknown — handled as such in any future reporting).
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS rate_at_creation DECIMAL(10,2);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS currency_at_creation CHAR(3);

-- ── Sessions: enforce duration is a positive multiple of 30 minutes ───────────
-- NOT VALID: existing rows are not checked (they may predate the dropdown constraint);
-- all new INSERTs and UPDATEs will be validated.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sessions_duration_multiple_of_30'
  ) THEN
    ALTER TABLE sessions ADD CONSTRAINT sessions_duration_multiple_of_30
      CHECK (duration_minutes > 0 AND duration_minutes % 30 = 0) NOT VALID;
  END IF;
END $$;

-- ── Packages: remove simple/pro/elite enum ────────────────────────────────────
-- package_name is now a free-text label for prepaid bundles (e.g. "30 lessons April 2025").
-- The column and table are unchanged; only the CHECK constraint is dropped.
ALTER TABLE packages DROP CONSTRAINT IF EXISTS packages_package_name_check;

-- ── Fix: shell-created teachers and students had email_verified = false ───────
-- The HANDOVER.md shell command and seed-admin.js never set email_verified = true,
-- leaving any manually-created teacher/student accounts unable to log in.
-- This one-time fix makes all existing accounts loginable.
UPDATE users SET email_verified = true WHERE role IN ('teacher', 'student');
