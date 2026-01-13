-- Create invitation_status enum
CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'declined');

-- Create catalogs table
CREATE TABLE catalogs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'My Listings',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create catalog_members table (many-to-many)
CREATE TABLE catalog_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id UUID NOT NULL REFERENCES catalogs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(catalog_id, user_id)
);

-- Create catalog_invitations table
CREATE TABLE catalog_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id UUID NOT NULL REFERENCES catalogs(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  status invitation_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days')
);

-- Create listing_notes table (replaces notes column in listings)
CREATE TABLE listing_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(listing_id, user_id)
);

-- Add catalog_id to listings table (nullable initially for migration)
ALTER TABLE listings ADD COLUMN IF NOT EXISTS catalog_id UUID REFERENCES catalogs(id) ON DELETE CASCADE;

-- Create indexes
CREATE INDEX idx_catalogs_created_by ON catalogs(created_by);
CREATE INDEX idx_catalog_members_catalog_id ON catalog_members(catalog_id);
CREATE INDEX idx_catalog_members_user_id ON catalog_members(user_id);
CREATE INDEX idx_catalog_invitations_token ON catalog_invitations(token);
CREATE INDEX idx_catalog_invitations_email ON catalog_invitations(invited_email);
CREATE INDEX idx_listing_notes_listing_id ON listing_notes(listing_id);
CREATE INDEX idx_listing_notes_user_id ON listing_notes(user_id);
CREATE INDEX idx_listings_catalog_id ON listings(catalog_id);

-- Enable Row Level Security
ALTER TABLE catalogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for catalogs
CREATE POLICY "Users can view catalogs they are members of"
  ON catalogs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM catalog_members
      WHERE catalog_members.catalog_id = catalogs.id
      AND catalog_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create catalogs"
  ON catalogs FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update catalogs they are members of"
  ON catalogs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM catalog_members
      WHERE catalog_members.catalog_id = catalogs.id
      AND catalog_members.user_id = auth.uid()
    )
  );

-- RLS Policies for catalog_members
CREATE POLICY "Users can view their own catalog memberships"
  ON catalog_members FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view members of catalogs they belong to"
  ON catalog_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM catalog_members cm
      WHERE cm.catalog_id = catalog_members.catalog_id
      AND cm.user_id = auth.uid()
      AND cm.id != catalog_members.id  -- Avoid self-reference
    )
  );

CREATE POLICY "Users can add themselves to catalogs via invitation"
  ON catalog_members FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM catalog_invitations
      WHERE catalog_invitations.catalog_id = catalog_members.catalog_id
      AND catalog_invitations.invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND catalog_invitations.status = 'pending'
      AND catalog_invitations.expires_at > NOW()
    )
  );

-- RLS Policies for catalog_invitations
CREATE POLICY "Users can view invitations sent to them"
  ON catalog_invitations FOR SELECT
  USING (
    invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR invited_by = auth.uid()
  );

CREATE POLICY "Users can create invitations for catalogs they belong to"
  ON catalog_invitations FOR INSERT
  WITH CHECK (
    invited_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM catalog_members
      WHERE catalog_members.catalog_id = catalog_invitations.catalog_id
      AND catalog_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update invitations sent to them"
  ON catalog_invitations FOR UPDATE
  USING (
    invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- RLS Policies for listing_notes
CREATE POLICY "Users can view notes in catalogs they belong to"
  ON listing_notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM listings
      JOIN catalog_members ON catalog_members.catalog_id = listings.catalog_id
      WHERE listings.id = listing_notes.listing_id
      AND catalog_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create notes in catalogs they belong to"
  ON listing_notes FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM listings
      JOIN catalog_members ON catalog_members.catalog_id = listings.catalog_id
      WHERE listings.id = listing_notes.listing_id
      AND catalog_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own notes"
  ON listing_notes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notes"
  ON listing_notes FOR DELETE
  USING (auth.uid() = user_id);

-- Update RLS Policies for listings to check catalog membership
DROP POLICY IF EXISTS "Users can view their own listings" ON listings;
CREATE POLICY "Users can view listings in catalogs they belong to"
  ON listings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM catalog_members
      WHERE catalog_members.catalog_id = listings.catalog_id
      AND catalog_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert their own listings" ON listings;
CREATE POLICY "Users can insert listings into catalogs they belong to"
  ON listings FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM catalog_members
      WHERE catalog_members.catalog_id = listings.catalog_id
      AND catalog_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their own listings" ON listings;
CREATE POLICY "Users can update listings in catalogs they belong to"
  ON listings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM catalog_members
      WHERE catalog_members.catalog_id = listings.catalog_id
      AND catalog_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete their own listings" ON listings;
CREATE POLICY "Users can delete listings they created"
  ON listings FOR DELETE
  USING (auth.uid() = user_id);

-- Update listing_metadata RLS to check catalog membership
DROP POLICY IF EXISTS "Users can view metadata of their own listings" ON listing_metadata;
CREATE POLICY "Users can view metadata of listings in catalogs they belong to"
  ON listing_metadata FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM listings
      JOIN catalog_members ON catalog_members.catalog_id = listings.catalog_id
      WHERE listings.id = listing_metadata.listing_id
      AND catalog_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert metadata for their own listings" ON listing_metadata;
CREATE POLICY "Users can insert metadata for listings in catalogs they belong to"
  ON listing_metadata FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM listings
      JOIN catalog_members ON catalog_members.catalog_id = listings.catalog_id
      WHERE listings.id = listing_metadata.listing_id
      AND catalog_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update metadata of their own listings" ON listing_metadata;
CREATE POLICY "Users can update metadata of listings in catalogs they belong to"
  ON listing_metadata FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM listings
      JOIN catalog_members ON catalog_members.catalog_id = listings.catalog_id
      WHERE listings.id = listing_metadata.listing_id
      AND catalog_members.user_id = auth.uid()
    )
  );

-- Add trigger for listing_notes updated_at
CREATE TRIGGER update_listing_notes_updated_at
  BEFORE UPDATE ON listing_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add trigger for catalogs updated_at
CREATE TRIGGER update_catalogs_updated_at
  BEFORE UPDATE ON catalogs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Data migration: Create default catalog for each existing user and migrate their listings
DO $$
DECLARE
  user_record RECORD;
  default_catalog_id UUID;
BEGIN
  FOR user_record IN SELECT DISTINCT user_id FROM listings LOOP
    -- Create default catalog for this user
    INSERT INTO catalogs (name, created_by)
    VALUES ('My Listings', user_record.user_id)
    RETURNING id INTO default_catalog_id;
    
    -- Add user as member of their catalog
    INSERT INTO catalog_members (catalog_id, user_id)
    VALUES (default_catalog_id, user_record.user_id);
    
    -- Assign all user's listings to their default catalog
    UPDATE listings
    SET catalog_id = default_catalog_id
    WHERE user_id = user_record.user_id AND catalog_id IS NULL;
    
    -- Migrate notes from listings.notes to listing_notes
    INSERT INTO listing_notes (listing_id, user_id, note)
    SELECT id, user_id, notes
    FROM listings
    WHERE user_id = user_record.user_id
    AND notes IS NOT NULL
    AND notes != ''
    ON CONFLICT (listing_id, user_id) DO NOTHING;
  END LOOP;
END $$;

-- Make catalog_id required after migration
ALTER TABLE listings ALTER COLUMN catalog_id SET NOT NULL;

