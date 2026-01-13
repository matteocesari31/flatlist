-- Remove the unique constraint on (listing_id, user_id) to allow multiple messages per user
ALTER TABLE listing_notes DROP CONSTRAINT IF EXISTS listing_notes_listing_id_user_id_key;
