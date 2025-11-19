# Supabase Dashboard Connection Issues

## Problem
The dashboard is showing "Error fetching emails: {}" and "Error fetching orders: {}"

## Likely Cause
Supabase Row Level Security (RLS) is blocking anonymous access to the tables.

## Quick Fix

### Option 1: Disable RLS for Development (Recommended for now)

Go to Supabase Dashboard → SQL Editor and run:

```sql
-- Disable RLS on email_logs (temporarily for development)
ALTER TABLE email_logs DISABLE ROW LEVEL SECURITY;

-- Disable RLS on orders_tracker (temporarily for development)
ALTER TABLE orders_tracker DISABLE ROW LEVEL SECURITY;

-- Disable RLS on agent_logs (temporarily for development)
ALTER TABLE agent_logs DISABLE ROW LEVEL SECURITY;
```

### Option 2: Create Proper RLS Policies (Production-ready)

```sql
-- Enable RLS
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders_tracker ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_logs ENABLE ROW LEVEL SECURITY;

-- Create policies to allow read access with anon key
CREATE POLICY "Allow public read access on email_logs"
  ON email_logs FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow public read access on orders_tracker"
  ON orders_tracker FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow public read access on agent_logs"
  ON agent_logs FOR SELECT
  TO anon
  USING (true);
```

## Steps to Fix:

1. Go to: https://supabase.com/dashboard/project/ajdehycoypilsegmxbto
2. Click "SQL Editor" in the left menu
3. Click "New Query"
4. Paste **Option 1** SQL (for quick fix)
5. Click "Run" or press Ctrl+Enter
6. Refresh the dashboard at http://localhost:3001

## Verify Tables Exist

Check if the tables exist:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('email_logs', 'orders_tracker', 'agent_logs');
```

## Test Connection

You can test the connection directly in the browser console:

```javascript
// Open browser console (F12) on the dashboard and run:
const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
const supabase = createClient(
  'https://ajdehycoypilsegmxbto.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqZGVoeWNveXBpbHNlZ214YnRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzE3NjAzNTUsImV4cCI6MjA0NzMzNjM1NX0.Kms-6JLJFz0wPVpq5_xyANMDMTbuQrH5C0uqsIaVwk8'
)

// Test email_logs
const { data, error } = await supabase.from('email_logs').select('*').limit(5)
console.log('Data:', data, 'Error:', error)
```

## Alternative: Check Supabase Table Editor

1. Go to: https://supabase.com/dashboard/project/ajdehycoypilsegmxbto
2. Click "Table Editor" in the left menu
3. Check if these tables exist:
   - `email_logs`
   - `orders_tracker`
   - `agent_logs`
4. Click on each table to see if there's data

If tables don't exist, run the migrations from the backend:

```bash
cd "D:\AudicoAI\Audico Management Team\audico-ai"
python run_migrations_simple.py
```

## Once Fixed

The dashboard should show:
- **Email Queue**: List of processed emails
- **Orders**: Order tracking data
- **Logs**: Agent activity logs

Refresh the dashboard after applying the SQL fixes!
