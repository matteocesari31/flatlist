-- Add notes column to listings table
ALTER TABLE listings ADD COLUMN IF NOT EXISTS notes TEXT;

