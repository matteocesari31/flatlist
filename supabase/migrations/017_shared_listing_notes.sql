-- Convert listing_notes to shared notes (one note per listing, editable by all catalog members)

-- First, consolidate existing notes per listing (keep the most recent note)
-- This handles migration of existing data
DO $$
DECLARE
  listing_record RECORD;
  latest_note RECORD;
BEGIN
  -- For each listing, find the latest note
  FOR listing_record IN SELECT DISTINCT listing_id FROM listing_notes LOOP
    -- Get the latest note for this listing
    SELECT * INTO latest_note
    FROM listing_notes
    WHERE listing_id = listing_record.listing_id
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- Delete all notes for this listing
    DELETE FROM listing_notes WHERE listing_id = listing_record.listing_id;
    
    -- Insert back only the latest note (as the shared note)
    INSERT INTO listing_notes (id, listing_id, user_id, note, created_at, updated_at)
    VALUES (
      latest_note.id,
      latest_note.listing_id,
      latest_note.user_id,
      latest_note.note,
      latest_note.created_at,
      latest_note.updated_at
    );
  END LOOP;
END $$;

-- Drop the existing unique constraint if it exists
ALTER TABLE listing_notes DROP CONSTRAINT IF EXISTS listing_notes_listing_id_user_id_key;

-- Add unique constraint on listing_id only (one note per listing)
ALTER TABLE listing_notes ADD CONSTRAINT listing_notes_listing_id_key UNIQUE (listing_id);

-- Update RLS policies to allow any catalog member to update any note
DROP POLICY IF EXISTS "Users can update their own notes" ON listing_notes;
CREATE POLICY "Users can update notes in catalogs they belong to"
  ON listing_notes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM listings
      JOIN catalog_members ON catalog_members.catalog_id = listings.catalog_id
      WHERE listings.id = listing_notes.listing_id
      AND catalog_members.user_id = auth.uid()
    )
  );

-- Allow any catalog member to insert notes (will upsert via unique constraint)
DROP POLICY IF EXISTS "Users can create notes in catalogs they belong to" ON listing_notes;
CREATE POLICY "Users can create notes in catalogs they belong to"
  ON listing_notes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM listings
      JOIN catalog_members ON catalog_members.catalog_id = listings.catalog_id
      WHERE listings.id = listing_notes.listing_id
      AND catalog_members.user_id = auth.uid()
    )
  );

-- Allow any catalog member to delete notes
DROP POLICY IF EXISTS "Users can delete their own notes" ON listing_notes;
CREATE POLICY "Users can delete notes in catalogs they belong to"
  ON listing_notes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM listings
      JOIN catalog_members ON catalog_members.catalog_id = listings.catalog_id
      WHERE listings.id = listing_notes.listing_id
      AND catalog_members.user_id = auth.uid()
    )
  );
