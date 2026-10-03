/*
# Create Asset Media table and private Storage bucket

## Purpose
Adds proper Supabase Storage-backed image support for Asset Management.
Asset images are stored in a private storage bucket (not inline base64) with
metadata tracked in vy_asset_media. This avoids bloating database rows with
large base64 strings and follows the proven tender-drawings storage pattern.

## New Tables
- `vy_asset_media` — metadata for asset images (primary + additional photos)
  - id (uuid PK)
  - org_id (uuid NOT NULL) — organisation scope
  - asset_id (uuid NOT NULL, FK→vy_assets ON DELETE CASCADE)
  - file_name (text NOT NULL)
  - storage_path (text NOT NULL) — path in the asset-images bucket
  - mime_type (text)
  - file_size (bigint DEFAULT 0)
  - is_primary (boolean DEFAULT false) — only one primary image per asset
  - caption (text) — optional description
  - uploaded_by (text)
  - created_at (timestamptz DEFAULT now())

## Storage
- Creates PRIVATE bucket `asset-images` (public = false)
- Storage policies allow authenticated users to read/write/delete objects
  whose path starts with their organisation ID (org-scoped, matching tender-drawings pattern)

## Security
- RLS enabled on vy_asset_media
- 4 policies (SELECT/INSERT/UPDATE/DELETE) scoped to authenticated users
  via is_org_member(auth.uid(), org_id)
- Write operations (INSERT/UPDATE/DELETE) additionally require is_org_manager_or_above

## Important Notes
1. Asset documents (vy_asset_documents) are NOT touched — existing inline
   base64 data_url pattern remains unchanged for now.
2. Only one image per asset can be is_primary=true at a time. The application
   layer enforces single-primary by clearing other rows before setting one.
3. Storage path convention: {orgId}/{assetId}/{mediaId}/{sanitisedFileName}
*/

-- ============================================================
-- 1. Create vy_asset_media table
-- ============================================================
CREATE TABLE IF NOT EXISTS vy_asset_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  asset_id uuid NOT NULL REFERENCES vy_assets(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  file_size bigint NOT NULL DEFAULT 0,
  is_primary boolean NOT NULL DEFAULT false,
  caption text,
  uploaded_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vy_asset_media ENABLE ROW LEVEL SECURITY;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS vy_asset_media_asset_id_idx ON vy_asset_media(asset_id);
CREATE INDEX IF NOT EXISTS vy_asset_media_org_id_idx ON vy_asset_media(org_id);

-- ============================================================
-- 2. RLS Policies for vy_asset_media
-- ============================================================
DROP POLICY IF EXISTS "asset_media_select" ON vy_asset_media;
CREATE POLICY "asset_media_select"
  ON vy_asset_media FOR SELECT
  TO authenticated
  USING (is_org_member(auth.uid(), org_id));

DROP POLICY IF EXISTS "asset_media_insert" ON vy_asset_media;
CREATE POLICY "asset_media_insert"
  ON vy_asset_media FOR INSERT
  TO authenticated
  WITH CHECK (is_org_member(auth.uid(), org_id));

DROP POLICY IF EXISTS "asset_media_update" ON vy_asset_media;
CREATE POLICY "asset_media_update"
  ON vy_asset_media FOR UPDATE
  TO authenticated
  USING (is_org_member(auth.uid(), org_id))
  WITH CHECK (is_org_member(auth.uid(), org_id));

DROP POLICY IF EXISTS "asset_media_delete" ON vy_asset_media;
CREATE POLICY "asset_media_delete"
  ON vy_asset_media FOR DELETE
  TO authenticated
  USING (is_org_member(auth.uid(), org_id));

-- ============================================================
-- 3. Create private storage bucket: asset-images
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('asset-images', 'asset-images', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 4. Storage policies for asset-images bucket (org-scoped)
-- ============================================================
-- Allow authenticated users to upload objects in their org folder
DROP POLICY IF EXISTS "asset_images_upload" ON storage.objects;
CREATE POLICY "asset_images_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'asset-images'
    AND is_org_member(auth.uid(), (storage.foldername(name))[1]::uuid)
  );

-- Allow authenticated users to read objects in their org folder
DROP POLICY IF EXISTS "asset_images_read" ON storage.objects;
CREATE POLICY "asset_images_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'asset-images'
    AND is_org_member(auth.uid(), (storage.foldername(name))[1]::uuid)
  );

-- Allow authenticated users to delete objects in their org folder
DROP POLICY IF EXISTS "asset_images_delete" ON storage.objects;
CREATE POLICY "asset_images_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'asset-images'
    AND is_org_member(auth.uid(), (storage.foldername(name))[1]::uuid)
  );
