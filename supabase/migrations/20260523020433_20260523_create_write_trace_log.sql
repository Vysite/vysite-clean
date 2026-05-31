/*
  # Create write trace log table — TEMPORARY DIAGNOSTIC ONLY
  Stores every DB write event with stack trace so the seeding source
  can be identified from the server side without needing browser console access.
  Drop this table once the source is found.
*/
CREATE TABLE IF NOT EXISTS vy_write_trace_log (
  id bigserial PRIMARY KEY,
  operation text NOT NULL,
  table_name text NOT NULL,
  payload_ids text,
  stack_trace text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE vy_write_trace_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon can insert trace log"
  ON vy_write_trace_log FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon can select trace log"
  ON vy_write_trace_log FOR SELECT TO anon USING (true);
