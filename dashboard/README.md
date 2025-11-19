# Audico AI Dashboard

Next.js dashboard for managing the Audico AI Executive Management System.

## Features

- **Email Queue**: Review and approve AI-drafted email responses
- **Orders Tracker**: Monitor orders, suppliers, and shipments
- **Agent Logs**: View system activity and debugging information

## Setup

1. Copy environment variables:
```bash
cp .env.local.example .env.local
```

2. Edit `.env.local` with your credentials:
   - Get `NEXT_PUBLIC_SUPABASE_ANON_KEY` from Supabase project settings
   - Update `NEXT_PUBLIC_API_URL` if backend is running elsewhere

3. Install dependencies (already done):
```bash
npm install
```

4. Run development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000)

## Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anon/public key (for RLS)
- `NEXT_PUBLIC_API_URL`: Backend FastAPI URL (default: http://localhost:8000)

## Usage

### Email Queue

1. Navigate to "Email Queue"
2. View pending drafted emails
3. Click on an email to see full details
4. Click "Approve & Send" to send the email
5. The email will be sent via Gmail and marked as SENT

### Orders Tracker

View all orders from the Excel tracker mirrored in Supabase:
- Owner assignments (Wade, Lucky, Kenny, Accounts)
- Financial data (Cost, Shipping, Profit)
- Status flags (Done, Urgent, Paid)

### Agent Logs

Monitor system activity:
- Filter by agent or log level
- View detailed context for each event
- Useful for debugging and auditing

## Building for Production

```bash
npm run build
npm start
```

## Deployment

Deploy to Vercel:

1. Push to GitHub
2. Connect repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

## Stack

- **Next.js 15** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **Supabase Client** for database access
