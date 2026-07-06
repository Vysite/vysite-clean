/*
  # Add doc_title to vy_project_documents

  Adds an optional professional document title field to the project documents table.

  ## Change
  - `vy_project_documents.doc_title` (text, nullable, no default)
    Stores a user-provided display name for the document (e.g. "Mechanical Level 1 Drawings").
    When NULL or empty, the application falls back to the original filename stored in `name`.

  ## Behaviour
  - Existing documents are unaffected — their `doc_title` will be NULL, and the application
    will continue displaying their `name` (filename) as before.
  - New documents receive a `doc_title` set by the user at upload time (defaulting to the
    cleaned filename if the user does not provide one).
  - The `name` column is NOT removed or modified — it continues to hold the original filename
    and is used for download attributes and file type detection.

  ## No destructive changes.
*/

ALTER TABLE vy_project_documents ADD COLUMN IF NOT EXISTS doc_title text;
