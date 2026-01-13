-- Fix RLS policy for catalog_invitations to avoid subquery issues
-- The subquery (SELECT email FROM auth.users WHERE id = auth.uid()) might not work properly
-- Instead, we'll use a function to get the user's email

-- Drop the existing policy
DROP POLICY IF EXISTS "Users can view invitations sent to them" ON catalog_invitations;

-- Create a function to get the current user's email
CREATE OR REPLACE FUNCTION get_current_user_email()
RETURNS TEXT AS $$
  SELECT email::TEXT FROM auth.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Recreate the policy using the function
CREATE POLICY "Users can view invitations sent to them"
  ON catalog_invitations FOR SELECT
  USING (
    invited_email = get_current_user_email()
    OR invited_by = auth.uid()
  );

-- Also update the UPDATE policy to use the function
DROP POLICY IF EXISTS "Users can update invitations sent to them" ON catalog_invitations;

CREATE POLICY "Users can update invitations sent to them"
  ON catalog_invitations FOR UPDATE
  USING (
    invited_email = get_current_user_email()
  );

