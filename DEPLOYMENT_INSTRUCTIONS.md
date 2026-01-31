# Dream Apartment Feature - Deployment Instructions

## Summary of Changes

The comparison function has been optimized to process listings in **parallel batches of 3** instead of sequentially. This will significantly reduce the processing time from ~10 minutes to ~2-3 minutes for typical workloads.

## Steps to Deploy

### 1. Run Database Migration

Go to your Supabase Dashboard → SQL Editor and run:

```sql
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
```

### 2. Deploy the Supabase Function

Using Supabase CLI:

```bash
cd /Users/matteocesari/Desktop/progetti/flatlist
supabase functions deploy compare-listing
```

### 3. Deploy Frontend Changes

Your frontend changes will be deployed automatically with your next deployment (Vercel, etc.).

## What Changed

### Performance Optimization
- **Before**: Listings processed sequentially (one by one) with 500ms delay = ~10 minutes for 20 listings
- **After**: Listings processed in parallel batches of 3 with 1s delay between batches = ~2-3 minutes for 20 listings

### User Experience
- Loading state timeout reduced from 60s to 30s
- Better loading messages that indicate progress
- Real-time updates show scores as they become available

## Testing

After deployment:
1. Click the House button in the topbar
2. Enter your dream apartment description
3. Click Save
4. You should see scores appearing on listing cards within 2-3 minutes
5. Scores will update in real-time as the AI processes each listing

## Troubleshooting

If listings still take too long:
- Check browser console for errors
- Verify the `compare-listing` function is deployed
- Check Supabase logs for the function
- Ensure OpenAI API key is set in Supabase environment variables
