-- Fix all infinite recursion issues in RLS policies
-- The problem is policies querying the same table they're protecting, creating circular dependencies

-- ============================================
-- Fix catalog_members policies
-- ============================================

-- Drop all existing catalog_members policies
DROP POLICY IF EXISTS "Users can view catalog members of catalogs they belong to" ON catalog_members;
DROP POLICY IF EXISTS "Users can view their own catalog memberships" ON catalog_members;
DROP POLICY IF EXISTS "Users can view members of catalogs they created" ON catalog_members;

-- Simple policy: Users can view their own memberships (no circular dependency)
CREATE POLICY "Users can view their own catalog memberships"
  ON catalog_members FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================
-- Fix catalogs policies  
-- ============================================

-- Drop all existing catalog policies
DROP POLICY IF EXISTS "Users can view catalogs they are members of" ON catalogs;
DROP POLICY IF EXISTS "Users can view catalogs they created" ON catalogs;

-- Create a SECURITY DEFINER function to check membership without RLS recursion
CREATE OR REPLACE FUNCTION user_is_catalog_member(catalog_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM catalog_members 
    WHERE catalog_id = catalog_uuid
    AND user_id = user_uuid
  );
$$;

-- Policy 1: Users can view catalogs they created (no circular dependency)
CREATE POLICY "Users can view catalogs they created"
  ON catalogs FOR SELECT
  USING (auth.uid() = created_by);

-- Policy 2: Users can view catalogs where they have a membership
-- Use the SECURITY DEFINER function to avoid RLS recursion
CREATE POLICY "Users can view catalogs they are members of"
  ON catalogs FOR SELECT
  USING (user_is_catalog_member(catalogs.id, auth.uid()));

-- ============================================
-- Fix catalog_members INSERT policy
-- ============================================

-- The INSERT policy also has a circular dependency - it checks catalog_invitations
-- which might query catalog_members. Let's simplify it.
DROP POLICY IF EXISTS "Users can add themselves to catalogs via invitation" ON catalog_members;

-- Allow users to insert their own memberships if they created the catalog
-- OR if there's a valid invitation (we'll check this more carefully)
CREATE POLICY "Users can add themselves to catalogs via invitation"
  ON catalog_members FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    (
      -- User created the catalog
      EXISTS (
        SELECT 1 FROM catalogs
        WHERE catalogs.id = catalog_members.catalog_id
        AND catalogs.created_by = auth.uid()
      )
      OR
      -- User has a valid invitation
      EXISTS (
        SELECT 1 FROM catalog_invitations
        WHERE catalog_invitations.catalog_id = catalog_members.catalog_id
        AND catalog_invitations.invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())
        AND catalog_invitations.status = 'pending'
        AND catalog_invitations.expires_at > NOW()
      )
    )
  );

