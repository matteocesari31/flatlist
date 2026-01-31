-- Migration: Add Dream Apartment feature
-- Creates user_preferences and listing_comparisons tables

-- Table: user_preferences
-- Stores user's dream apartment description
CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    dream_apartment_description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: listing_comparisons
-- Stores AI comparison results between listings and user's dream apartment
CREATE TABLE IF NOT EXISTS listing_comparisons (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    listing_id UUID REFERENCES listings(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    match_score INTEGER CHECK (match_score >= 0 AND match_score <= 100),
    comparison_summary TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(listing_id, user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_listing_comparisons_listing_id ON listing_comparisons(listing_id);
CREATE INDEX IF NOT EXISTS idx_listing_comparisons_user_id ON listing_comparisons(user_id);
CREATE INDEX IF NOT EXISTS idx_listing_comparisons_listing_user ON listing_comparisons(listing_id, user_id);

-- Enable RLS
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_comparisons ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_preferences
-- Users can only see and modify their own preferences
CREATE POLICY "Users can view own preferences"
    ON user_preferences FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
    ON user_preferences FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
    ON user_preferences FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own preferences"
    ON user_preferences FOR DELETE
    USING (auth.uid() = user_id);

-- RLS Policies for listing_comparisons
-- Users can only see comparisons for their own listings or listings in catalogs they're members of
CREATE POLICY "Users can view own comparisons"
    ON listing_comparisons FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own comparisons"
    ON listing_comparisons FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own comparisons"
    ON listing_comparisons FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comparisons"
    ON listing_comparisons FOR DELETE
    USING (auth.uid() = user_id);

-- Service role bypass for edge functions
CREATE POLICY "Service role can manage all preferences"
    ON user_preferences FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can manage all comparisons"
    ON listing_comparisons FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Only create triggers if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_preferences_updated_at') THEN
        CREATE TRIGGER update_user_preferences_updated_at
            BEFORE UPDATE ON user_preferences
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_listing_comparisons_updated_at') THEN
        CREATE TRIGGER update_listing_comparisons_updated_at
            BEFORE UPDATE ON listing_comparisons
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Enable realtime for listing_comparisons so frontend can subscribe to updates
ALTER PUBLICATION supabase_realtime ADD TABLE listing_comparisons;
