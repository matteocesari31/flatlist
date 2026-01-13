-- Fix catalog_members SELECT policy to allow users to see all members of catalogs they belong to
-- The current policy only allows users to see their own memberships, which prevents
-- displaying all collaborators' profile pictures

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can view their own catalog memberships" ON catalog_members;

-- Create a policy that allows users to view all members of catalogs they belong to
-- Use the user_is_catalog_member function to avoid circular dependencies
CREATE POLICY "Users can view members of catalogs they belong to"
  ON catalog_members FOR SELECT
  USING (
    -- User can see their own membership
    auth.uid() = user_id
    OR
    -- User can see other members if they belong to the same catalog
    user_is_catalog_member(catalog_id, auth.uid())
  );

