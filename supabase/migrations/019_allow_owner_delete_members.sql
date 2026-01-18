-- Migration: Allow catalog owners to remove members
-- This adds an RLS policy for owners to delete other members from their catalogs

-- RLS Policy for catalog owners to delete members
CREATE POLICY "Catalog owners can remove members"
  ON catalog_members FOR DELETE
  USING (
    -- User must be an owner of this catalog
    EXISTS (
      SELECT 1 FROM catalog_members owner_check
      WHERE owner_check.catalog_id = catalog_members.catalog_id
      AND owner_check.user_id = auth.uid()
      AND owner_check.role = 'owner'
    )
    -- Cannot delete themselves (owner)
    AND catalog_members.user_id != auth.uid()
  );

-- Also allow users to leave a catalog themselves (except if they are the only owner)
CREATE POLICY "Users can leave catalogs they belong to"
  ON catalog_members FOR DELETE
  USING (
    auth.uid() = user_id
    AND (
      -- Either user is not an owner, so they can always leave
      role != 'owner'
      OR
      -- Or there's at least one other owner
      EXISTS (
        SELECT 1 FROM catalog_members other_owner
        WHERE other_owner.catalog_id = catalog_members.catalog_id
        AND other_owner.user_id != auth.uid()
        AND other_owner.role = 'owner'
      )
    )
  );
