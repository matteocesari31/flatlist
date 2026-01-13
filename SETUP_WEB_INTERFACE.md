# Setting Up Supabase via Web Interface

Since the CLI installation requires updating Command Line Tools, you can set up the database using the Supabase web interface.

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Click "New Project"
3. Fill in:
   - Name: `casapin` (or any name)
   - Database Password: (save this securely!)
   - Region: Choose closest to you
4. Wait for project creation (~2 minutes)

## Step 2: Get Your Credentials

1. In your Supabase project dashboard, go to **Settings** → **API**
2. Copy these values:
   - **Project URL** → This is your `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → This is your `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Step 3: Update Environment Variables

Edit `web/.env.local` and paste your credentials:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
OPENAI_API_KEY=your-openai-key-here
```

## Step 4: Run Database Migration

1. In Supabase dashboard, go to **SQL Editor**
2. Click **New Query**
3. Copy the entire contents of `supabase/migrations/001_initial_schema.sql`
4. Paste it into the SQL Editor
5. Click **Run** (or press Cmd+Enter)
6. You should see "Success. No rows returned"

## Step 5: Set Up Edge Functions (via Web)

### For save-listing function:

1. Go to **Edge Functions** in the dashboard
2. Click **Create a new function**
3. Name it: `save-listing`
4. Copy the contents of `supabase/functions/save-listing/index.ts`
5. Paste into the function editor
6. Click **Deploy**

### For enrich-listing function:

1. Create another function named: `enrich-listing`
2. Copy contents of `supabase/functions/enrich-listing/index.ts`
3. Paste and deploy

### Set OpenAI Secret:

1. In the `enrich-listing` function settings
2. Go to **Secrets**
3. Add secret:
   - Key: `OPENAI_API_KEY`
   - Value: Your OpenAI API key

## Step 6: Test the Setup

1. Restart your dev server:
   ```bash
   # Stop current server (Ctrl+C)
   npm run dev
   ```

2. Open `http://localhost:3000`
3. You should be able to sign in with magic link!

## Alternative: Use Supabase CLI Later

Once you update Command Line Tools, you can use CLI commands:

```bash
# After updating Command Line Tools
brew install supabase/tap/supabase
supabase login
supabase link --project-ref your-project-ref
supabase db push
supabase functions deploy save-listing
supabase functions deploy enrich-listing
```

But the web interface works just as well for now!

