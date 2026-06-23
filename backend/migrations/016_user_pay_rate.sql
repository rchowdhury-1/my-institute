-- Migration 016: Teacher pay rate for salary calculation

ALTER TABLE users ADD COLUMN IF NOT EXISTS pay_rate_per_hour NUMERIC(10,2);
ALTER TABLE users ADD COLUMN IF NOT EXISTS pay_currency TEXT NOT NULL DEFAULT 'GBP';
