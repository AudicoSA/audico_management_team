# AUDICO-CHAT-QUOTE-X

Fresh start folder for the rebuilt quote chat system.

## Contents

1. **CHAT_QUOTE_PLAN_X.md** - The complete rebuild plan
2. **ENV_TEMPLATE.md** - Environment variables documentation
3. **.env.template** - Copy this to `.env.local`
4. **DATABASE_SCHEMA.md** - Supabase tables and functions
5. **WORKING_CODE.md** - Code to preserve from the old system

## Quick Start

1. Create a new Next.js project:
   ```bash
   npx create-next-app@latest audico-chat-quote-x --typescript --tailwind --app
   ```

2. Copy `.env.template` to `.env.local` and fill in your values

3. Set up Supabase:
   - Create project at supabase.com
   - Enable pgvector extension
   - Run migrations from DATABASE_SCHEMA.md

4. Follow CHAT_QUOTE_PLAN_X.md implementation order

## The Golden Rule

**AI talks. Backend decides.**

The AI generates friendly text. The backend controls:
- What products to show
- What step is next
- What's in the quote
- When the quote is complete

## Success Metric

User clicks 5 times, gets a complete quote. No confusion. No loops. No "what?" moments.
