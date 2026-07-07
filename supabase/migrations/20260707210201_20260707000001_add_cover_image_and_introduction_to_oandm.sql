-- Add cover_image_data_url and introduction columns to vy_o_and_m_manuals.
-- introduction replaces the generic 'notes' field with a purposeful name.
-- notes is kept for backward compatibility (existing data preserved).

ALTER TABLE vy_o_and_m_manuals
  ADD COLUMN IF NOT EXISTS cover_image_data_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS introduction         text NOT NULL DEFAULT '';
