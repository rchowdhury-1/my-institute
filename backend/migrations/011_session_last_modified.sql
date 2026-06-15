ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_modified_by UUID REFERENCES users(id);
