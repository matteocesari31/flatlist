-- Add pet_friendly, balcony, and listing_type fields to listing_metadata table
ALTER TABLE listing_metadata 
  ADD COLUMN IF NOT EXISTS pet_friendly BOOLEAN,
  ADD COLUMN IF NOT EXISTS balcony BOOLEAN,
  ADD COLUMN IF NOT EXISTS listing_type TEXT; -- 'rent' or 'sale'
