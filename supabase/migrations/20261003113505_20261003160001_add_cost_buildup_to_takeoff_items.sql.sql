/*
# Add Cost Build-Up fields to Take-Off Items

## Purpose
Stage D — Take-Off Cost Build-Up: adds material and labour cost fields
to vy_tender_takeoff_items so each Take-Off item can store its own
cost basis for future Estimate sync.

## Changes (ADDITIVE only — no existing columns modified or removed)
### vy_tender_takeoff_items — new columns:
- material_cost_rate (numeric(14,4) DEFAULT 0) — cost per Take-Off unit (£/m, £/nr, £/m²)
- labour_basis (text DEFAULT 'per_unit', CHECK in 'per_unit','lump_sum') — how labour is calculated
- labour_minutes_per_unit (integer DEFAULT 0) — minutes of labour per Take-Off unit (per_unit basis)
- labour_minutes_lump_sum (integer DEFAULT 0) — total minutes of labour for the item (lump_sum basis)
- labour_rate (numeric(14,4) DEFAULT 0) — labour rate per hour (£/hr)

## Security
No RLS policy changes. Existing org-scoped policies on vy_tender_takeoff_items
already govern SELECT/INSERT/UPDATE/DELETE. New columns are automatically
covered by existing policies.

## Important Notes
1. ADDITIVE only — no existing columns modified, renamed, or removed.
2. No new tables created.
3. No Estimate linkage — these fields store Take-Off's own cost basis only.
4. Totals (material_cost_total, labour_cost_total, total_cost) are NOT stored —
   they are derived at runtime from quantity × rate to avoid stale values.
5. Time is stored as integer minutes for reliable calculation (1h 30m = 90),
   not decimal hours, to prevent misinterpretation.
*/
ALTER TABLE vy_tender_takeoff_items
  ADD COLUMN IF NOT EXISTS material_cost_rate numeric(14,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS labour_basis text NOT NULL DEFAULT 'per_unit' CHECK (labour_basis IN ('per_unit', 'lump_sum')),
  ADD COLUMN IF NOT EXISTS labour_minutes_per_unit integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS labour_minutes_lump_sum integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS labour_rate numeric(14,4) NOT NULL DEFAULT 0;
