-- Add images column to listings table
-- This column stores an array of image URLs as JSONB

ALTER TABLE listings 
ADD COLUMN IF NOT EXISTS images JSONB;

-- Add comment to document the column
COMMENT ON COLUMN listings.images IS 'Array of image URLs extracted from the listing page';

