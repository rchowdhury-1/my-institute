-- Phase 5 patch: zoom_link on weekly schedules
-- Generated sessions inherit schedule.zoom_link at creation time.
ALTER TABLE weekly_schedules ADD COLUMN IF NOT EXISTS zoom_link TEXT;
