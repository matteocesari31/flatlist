-- Fix circular dependency in catalog_members RLS policy
-- The original policy had a circular dependency: it checked membership by querying the same table

-- Drop the old policy
DROP POLICY IF EXISTS "Users can view catalog members of catalogs they belong to" ON catalog_members;

-- Policy 1: Users can always view their own memberships (no circular dependency)
-- This is the most important one - users need to see their own memberships to find their catalogs
CREATE POLICY "Users can view their own catalog memberships"
  ON catalog_members FOR SELECT
  USING (auth.uid() = user_id);

-- Policy 2: Users can view members of catalogs they created
CREATE POLICY "Users can view members of catalogs they created"
  ON catalog_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM catalogs
      WHERE catalogs.id = catalog_members.catalog_id
      AND catalogs.created_by = auth.uid()
    )
  );

