-- Create enrichment_status enum
CREATE TYPE enrichment_status AS ENUM ('pending', 'processing', 'done', 'failed');

-- Create listings table
CREATE TABLE listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  title TEXT,
  raw_content TEXT NOT NULL,
  images JSONB, -- Array of image URLs
  enrichment_status enrichment_status NOT NULL DEFAULT 'pending',
  saved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create listing_metadata table
CREATE TABLE listing_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  
  -- Hard facts
  price NUMERIC,
  address TEXT,
  size_sqm NUMERIC,
  rooms INTEGER,
  beds_single INTEGER,
  beds_double INTEGER,
  furnishing TEXT,
  
  -- Inferred attributes
  student_friendly BOOLEAN,
  floor_type TEXT, -- 'wood', 'tile', 'unknown'
  natural_light TEXT, -- 'low', 'medium', 'high'
  noise_level TEXT, -- 'low', 'medium', 'high'
  renovation_state TEXT, -- 'new', 'ok', 'old'
  
  -- Vibe tags
  vibe_tags TEXT[],
  
  -- Evidence snippets supporting inferences
  evidence JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(listing_id)
);

-- Create indexes
CREATE INDEX idx_listings_user_id ON listings(user_id);
CREATE INDEX idx_listings_enrichment_status ON listings(enrichment_status);
CREATE INDEX idx_listings_saved_at ON listings(saved_at DESC);
CREATE INDEX idx_listing_metadata_listing_id ON listing_metadata(listing_id);

-- Enable Row Level Security
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_metadata ENABLE ROW LEVEL SECURITY;

-- RLS Policies for listings
CREATE POLICY "Users can view their own listings"
  ON listings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own listings"
  ON listings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own listings"
  ON listings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own listings"
  ON listings FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for listing_metadata
CREATE POLICY "Users can view metadata of their own listings"
  ON listing_metadata FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_metadata.listing_id
      AND listings.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert metadata for their own listings"
  ON listing_metadata FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_metadata.listing_id
      AND listings.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update metadata of their own listings"
  ON listing_metadata FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_metadata.listing_id
      AND listings.user_id = auth.uid()
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_listings_updated_at
  BEFORE UPDATE ON listings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_listing_metadata_updated_at
  BEFORE UPDATE ON listing_metadata
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

