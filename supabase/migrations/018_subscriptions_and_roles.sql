-- Migration: Add subscription tracking and catalog member roles
-- This migration adds support for the premium/free subscription model

-- Create user_subscriptions table to track subscription status
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'premium')),
  polar_customer_id TEXT,
  polar_subscription_id TEXT,
  current_period_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for user_subscriptions
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_polar_customer_id ON user_subscriptions(polar_customer_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_polar_subscription_id ON user_subscriptions(polar_subscription_id);

-- Enable RLS on user_subscriptions
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_subscriptions
-- Users can view their own subscription
CREATE POLICY "Users can view their own subscription"
  ON user_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own subscription (for initial creation)
CREATE POLICY "Users can insert their own subscription"
  ON user_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Only service role can update subscriptions (via webhooks)
-- This is handled by using service role key in webhook handler

-- Add role column to catalog_members
-- Roles: 'owner' (can add + comment + invite), 'editor' (can add + comment), 'commenter' (comment only)
ALTER TABLE catalog_members ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'owner' 
  CHECK (role IN ('owner', 'editor', 'commenter'));

-- Create function to get user subscription
CREATE OR REPLACE FUNCTION get_user_subscription(user_uuid UUID)
RETURNS TABLE (
  plan TEXT,
  polar_customer_id TEXT,
  polar_subscription_id TEXT,
  current_period_end TIMESTAMP WITH TIME ZONE
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    us.plan,
    us.polar_customer_id,
    us.polar_subscription_id,
    us.current_period_end
  FROM user_subscriptions us
  WHERE us.user_id = user_uuid;
END;
$$;

-- Create function to check if user is premium
CREATE OR REPLACE FUNCTION is_user_premium(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_plan TEXT;
  period_end TIMESTAMP WITH TIME ZONE;
BEGIN
  SELECT plan, current_period_end INTO user_plan, period_end
  FROM user_subscriptions
  WHERE user_id = user_uuid;
  
  -- User is premium if plan is 'premium' and subscription hasn't expired
  -- (or if current_period_end is NULL, treat as active)
  IF user_plan = 'premium' THEN
    IF period_end IS NULL OR period_end > NOW() THEN
      RETURN TRUE;
    END IF;
  END IF;
  
  RETURN FALSE;
END;
$$;

-- Create function to count user's listings
CREATE OR REPLACE FUNCTION count_user_listings(user_uuid UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  listing_count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO listing_count
  FROM listings
  WHERE user_id = user_uuid;
  
  RETURN listing_count;
END;
$$;

-- Create function to get catalog member role
CREATE OR REPLACE FUNCTION get_catalog_member_role(p_catalog_id UUID, p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  member_role TEXT;
BEGIN
  SELECT role INTO member_role
  FROM catalog_members
  WHERE catalog_id = p_catalog_id AND user_id = p_user_id;
  
  RETURN member_role;
END;
$$;

-- Update trigger for user_subscriptions updated_at
CREATE OR REPLACE TRIGGER update_user_subscriptions_updated_at
  BEFORE UPDATE ON user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Update existing catalog_members to have 'owner' role for catalog creators
UPDATE catalog_members cm
SET role = 'owner'
FROM catalogs c
WHERE cm.catalog_id = c.id 
  AND cm.user_id = c.created_by
  AND cm.role IS DISTINCT FROM 'owner';

-- Create default subscription records for existing users (as free)
INSERT INTO user_subscriptions (user_id, plan)
SELECT DISTINCT user_id, 'free'
FROM listings
WHERE user_id NOT IN (SELECT user_id FROM user_subscriptions)
ON CONFLICT (user_id) DO NOTHING;

-- Also create subscriptions for users who have catalogs but no listings
INSERT INTO user_subscriptions (user_id, plan)
SELECT DISTINCT created_by, 'free'
FROM catalogs
WHERE created_by NOT IN (SELECT user_id FROM user_subscriptions)
ON CONFLICT (user_id) DO NOTHING;

-- Update RLS for listings to check role permissions
-- Editors and owners can insert listings, commenters cannot
DROP POLICY IF EXISTS "Users can insert listings into catalogs they belong to" ON listings;
CREATE POLICY "Users can insert listings into catalogs with appropriate role"
  ON listings FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM catalog_members
      WHERE catalog_members.catalog_id = listings.catalog_id
      AND catalog_members.user_id = auth.uid()
      AND catalog_members.role IN ('owner', 'editor')
    )
  );

-- Commenters can still view listings
-- (existing SELECT policy already allows this via catalog membership)

-- Update policy for listing_notes to allow all catalog members to comment
-- (this is already covered by existing policies, but let's make it explicit)
DROP POLICY IF EXISTS "Users can create notes in catalogs they belong to" ON listing_notes;
CREATE POLICY "All catalog members can create notes"
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
