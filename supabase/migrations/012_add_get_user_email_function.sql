-- Create a function to get user email by user_id
-- This will be used to display catalog member emails in the UI
CREATE OR REPLACE FUNCTION get_user_email(user_uuid UUID)
RETURNS TEXT AS $$
  SELECT email::TEXT FROM auth.users WHERE id = user_uuid;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_email(UUID) TO authenticated;

