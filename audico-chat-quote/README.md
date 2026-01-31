# Audico Chat Quote X

A modern, deterministic quote building system for audio equipment with a professional dark UI.

## Philosophy

**"Backend decides, AI talks"** - The system is deterministic and reliable. AI only handles:
- Intent detection (what does the user want?)
- Discovery conversation (extracting requirements)
- Friendly text responses

All product selection, step progression, and state management is handled by the backend.

## Features

- **System Design Flow**: Guided 5-step quote building for home cinema (5.1, 7.1) and commercial audio
- **Simple Quote Flow**: Direct product search and add to quote
- **Professional Dark UI**: Inspired by fintech designs with lime green accents
- **Package Detection**: Automatically skips steps when user selects a speaker package

## Tech Stack

- **Frontend**: Next.js 14, React 18, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: Supabase PostgreSQL with pgvector
- **AI**: OpenAI GPT-4o for intent detection
- **Search**: Hybrid search (vector + BM25)

## Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   Copy your Supabase and OpenAI keys to `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://ajdehycoypilsegmxbto.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_KEY=your_service_key
   OPENAI_API_KEY=your_openai_key
   ```

3. **Create the quotes table** (run in Supabase SQL Editor):
   ```sql
   CREATE TABLE IF NOT EXISTS quotes (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     session_id TEXT NOT NULL,
     flow_type TEXT NOT NULL,
     requirements JSONB NOT NULL DEFAULT '{}',
     steps JSONB NOT NULL DEFAULT '[]',
     current_step_index INT DEFAULT 0,
     selected_products JSONB DEFAULT '[]',
     status TEXT DEFAULT 'in_progress',
     created_at TIMESTAMPTZ DEFAULT NOW(),
     updated_at TIMESTAMPTZ DEFAULT NOW()
   );

   CREATE INDEX idx_quotes_session ON quotes(session_id);
   CREATE INDEX idx_quotes_status ON quotes(status);
   ```

4. **Run development server**
   ```bash
   npm run dev
   ```

5. **Open** http://localhost:3000

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── chat/           # Main chat entry point
│   │   ├── search/         # Product search
│   │   ├── system-design/  # Guided quote APIs
│   │   └── simple-quote/   # Direct quote APIs
│   └── page.tsx            # Main page
├── components/
│   ├── chat/               # Chat UI components
│   ├── products/           # Product cards
│   ├── quote/              # Quote summary
│   └── layout/             # Sidebar navigation
└── lib/
    ├── flows/              # Quote engines
    ├── ai/                 # Intent detection
    ├── search.ts           # Hybrid search
    ├── supabase.ts         # Database client
    └── types.ts            # TypeScript types
```

## Usage

### Building a Home Cinema System

1. Type: "I need a 7.1 home cinema setup, R200k budget"
2. System detects intent and starts guided flow
3. Select products for each component (AVR → Speakers → Sub)
4. Package detection auto-skips steps if you choose a speaker package
5. Generate quote when complete

### Quick Product Quote

1. Type: "Price on Denon X2800H"
2. System shows matching products
3. Click "Add to Quote"
4. Generate quote

## Design System

- **Background**: #0a0a0a (primary), #141414 (cards)
- **Accent**: #c8ff00 (lime green)
- **Text**: #ffffff (primary), #a1a1a1 (muted)
- **Border**: #262626

## Deployment to Vercel

### 1. Push to GitHub/GitLab

```bash
git init
git add .
git commit -m "Initial commit - Audico Chat Quote X"
git remote add origin https://github.com/YOUR_ORG/audico-chat-quote-x.git
git push -u origin main
```

### 2. Connect to Vercel

1. Go to [vercel.com](https://vercel.com) and import your repository
2. Add environment variables in Vercel dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_KEY`
   - `OPENAI_API_KEY`
3. Deploy!

### 3. Database Setup (Supabase)

Run this SQL in Supabase to create the quotes table:

```sql
CREATE TABLE IF NOT EXISTS quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  flow_type TEXT NOT NULL,
  requirements JSONB NOT NULL DEFAULT '{}',
  steps JSONB NOT NULL DEFAULT '[]',
  current_step_index INT DEFAULT 0,
  selected_products JSONB DEFAULT '[]',
  status TEXT DEFAULT 'in_progress',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_quotes_session ON quotes(session_id);
CREATE INDEX idx_quotes_status ON quotes(status);
GRANT ALL ON quotes TO authenticated, service_role;
```

## License

Proprietary - Audico SA
