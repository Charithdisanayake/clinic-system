-- Adds treatment images. Safe to run on a database that already applied
-- the original schema.sql. Run with:
--   psql "your-connection-string" -f db/migrations/001_add_treatment_images.sql

ALTER TABLE treatments ADD COLUMN IF NOT EXISTS image_path TEXT;
