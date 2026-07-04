-- Migration 020: lessons_remaining becomes an hours balance
-- The value now represents HOURS (sum of session durations), not a session count.
-- Attendance decrements by duration_minutes / 60 (30 min session = 0.5).
--
-- Type change only. Existing values are NOT converted here: per the
-- 2026-07-04 decision, the single real balance (Muhammad Ahmad) is verified
-- against Neon and set manually by the admin — no blind formula conversion.

ALTER TABLE weekly_schedules
  ALTER COLUMN lessons_remaining TYPE NUMERIC(6,2)
  USING lessons_remaining::numeric;
