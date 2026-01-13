-- Fix catalog_members INSERT policy to avoid "permission denied for table users" error
-- The policy tries to query auth.users which regular users can't access directly

-- Drop the existing INSERT policy
DROP POLICY IF EXISTS "Users can add themselves to catalogs via invitation" ON catalog_members;

-- The get_current_user_email() function was already created in migration 010
-- If it doesn't exist, create it here
CREATE OR REPLACE FUNCTION get_current_user_email()
RETURNS TEXT AS $$
  SELECT email::TEXT FROM auth.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Recreate the INSERT policy using the function instead of direct subquery
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
      -- User has a valid invitation (use function to get email)
      EXISTS (
        SELECT 1 FROM catalog_invitations
        WHERE catalog_invitations.catalog_id = catalog_members.catalog_id
        AND catalog_invitations.invited_email = get_current_user_email()
        AND catalog_invitations.status = 'pending'
        AND catalog_invitations.expires_at > NOW()
      )
    )
  );

