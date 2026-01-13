-- Add latitude and longitude columns to listing_metadata table
-- These will store the geographical coordinates of the listing address

ALTER TABLE listing_metadata 
ADD COLUMN IF NOT EXISTS latitude NUMERIC,
ADD COLUMN IF NOT EXISTS longitude NUMERIC;

-- Add index for geospatial queries (if you want to search by proximity)
CREATE INDEX IF NOT EXISTS idx_listing_metadata_location 
ON listing_metadata(latitude, longitude) 
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Add comment to document the columns
COMMENT ON COLUMN listing_metadata.latitude IS 'Latitude coordinate of the listing address (geocoded)';
COMMENT ON COLUMN listing_metadata.longitude IS 'Longitude coordinate of the listing address (geocoded)';

