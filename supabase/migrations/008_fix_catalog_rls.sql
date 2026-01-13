-- Fix catalog RLS policy to allow users to see catalogs they created
-- Drop the old policy
DROP POLICY IF EXISTS "Users can view catalogs they are members of" ON catalogs;

-- Policy 1: Users can view catalogs they created
CREATE POLICY "Users can view catalogs they created"
  ON catalogs FOR SELECT
  USING (auth.uid() = created_by);

-- Policy 2: Users can view catalogs they are members of
CREATE POLICY "Users can view catalogs they are members of"
  ON catalogs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM catalog_members
      WHERE catalog_members.catalog_id = catalogs.id
      AND catalog_members.user_id = auth.uid()
    )
  );

