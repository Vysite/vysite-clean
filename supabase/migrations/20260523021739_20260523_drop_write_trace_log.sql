/*
  # Drop temporary diagnostic table vy_write_trace_log
  Write interceptor and trace logging have been removed from the codebase.
  This table is no longer needed.
*/
DROP TABLE IF EXISTS vy_write_trace_log;
