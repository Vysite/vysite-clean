-- Composite index for the primary Site Forms query: filter by org, sort by date.
-- Replaces reliance on the single-column org_id index.
CREATE INDEX IF NOT EXISTS idx_vy_site_forms_org_created
  ON public.vy_site_forms (org_id, created_at DESC);
