-- Migration: Allow catalog collaborators to see catalog owner's dream apartment and AI comparisons
-- When a user is a member of a catalog they didn't create, they can read the catalog owner's
-- user_preferences (dream apartment description) and listing_comparisons (scores/summaries)
-- for listings in that catalog.

-- user_preferences: catalog members can view the catalog owner's preferences
CREATE POLICY "Catalog members can view catalog owner preferences"
    ON user_preferences FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM catalog_members cm
        JOIN catalogs c ON c.id = cm.catalog_id AND c.created_by = user_preferences.user_id
        WHERE cm.user_id = auth.uid()
      )
    );

-- listing_comparisons: catalog members can view comparisons for listings in their catalog
-- when the comparison belongs to the catalog owner
CREATE POLICY "Catalog members can view owner comparisons for catalog listings"
    ON listing_comparisons FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM listings l
        JOIN catalogs c ON c.id = l.catalog_id AND c.created_by = listing_comparisons.user_id
        JOIN catalog_members cm ON cm.catalog_id = c.id AND cm.user_id = auth.uid()
        WHERE l.id = listing_comparisons.listing_id
      )
    );
