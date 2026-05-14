-- Add optional fields to scholarship_applications

ALTER TABLE scholarship_applications ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE scholarship_applications ADD COLUMN IF NOT EXISTS age INTEGER;
-- 'about' column already stores the applicant's story
-- 'referral_source' column already stores how they heard about us
