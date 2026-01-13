-- Add condo fees column to listing_metadata
ALTER TABLE listing_metadata 
ADD COLUMN IF NOT EXISTS condo_fees NUMERIC;

