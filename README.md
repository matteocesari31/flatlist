# CasaPin MVP

AI-powered apartment shortlist assistant for Italian real estate.

## Project Structure

- `extension/` - Chrome browser extension
- `web/` - Next.js frontend application
- `supabase/` - Supabase configuration and Edge Functions

## Setup

1. Install dependencies:
```bash
npm install
cd web && npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Fill in your Supabase and OpenAI credentials
```

3. Set up Supabase:
```bash
# Install Supabase CLI if needed
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

4. Start development:
```bash
npm run dev
```

## Extension Setup

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `extension/` directory

