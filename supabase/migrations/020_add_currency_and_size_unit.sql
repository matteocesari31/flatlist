-- Migration: Add currency and size_unit fields to listing_metadata
-- This allows storing the original currency and unit system (sqft vs sqm) from listings

-- Add currency field (stores currency code like 'EUR', 'USD', 'GBP', etc.)
ALTER TABLE listing_metadata
ADD COLUMN IF NOT EXISTS currency TEXT;

-- Add size_unit field (stores 'sqm' or 'sqft')
ALTER TABLE listing_metadata
ADD COLUMN IF NOT EXISTS size_unit TEXT DEFAULT 'sqm';

-- Add comment for documentation
COMMENT ON COLUMN listing_metadata.currency IS 'Currency code from the original listing (EUR, USD, GBP, CHF, etc.)';
COMMENT ON COLUMN listing_metadata.size_unit IS 'Unit system for size: sqm (square meters) or sqft (square feet)';
