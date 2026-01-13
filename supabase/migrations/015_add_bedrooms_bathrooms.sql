-- Add bedrooms and bathrooms fields to listing_metadata table
ALTER TABLE listing_metadata 
  ADD COLUMN IF NOT EXISTS bedrooms INTEGER,
  ADD COLUMN IF NOT EXISTS bathrooms INTEGER;
