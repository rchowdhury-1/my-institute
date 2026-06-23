-- Migration 017: Drop unused lessons table from migration 001
-- The sessions table (migration 002) replaced it entirely.
-- Verify empty before applying: SELECT COUNT(*) FROM lessons;

DROP TABLE IF EXISTS lessons;
