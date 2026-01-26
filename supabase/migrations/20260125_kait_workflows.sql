-- Create kait_workflows table to track Agent State
create table if not exists public.kait_workflows (
    id uuid primary key default uuid_generate_v4(),
    order_no text references public.orders_tracker(order_no),
    status text, -- 'new', 'customer_emailed', 'supplier_contacted', 'waiting_reply', 'invoiced', 'paid', 'complete'
    
    -- Thread Tracking
    customer_thread_id text,
    supplier_thread_id text,
    
    -- Timestamps
    last_action_at timestamptz default now(),
    next_check_at timestamptz,
    created_at timestamptz default now(),
    
    -- Metadata
    nudge_count int default 0,
    logs jsonb default '[]'::jsonb, -- Array of actions: ["Emailed Kyle", "Nudged Kyle"]
    metadata jsonb default '{}'::jsonb -- For storing parsed invoice data or arbitrary context
);

-- Index for faster lookups during cron jobs
create index if not exists idx_kait_workflows_status on public.kait_workflows(status);
create index if not exists idx_kait_workflows_next_check on public.kait_workflows(next_check_at);

-- RLS Policies
ALTER TABLE public.kait_workflows ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    -- Policy: Enable read access for all users
    IF NOT EXISTS (
        SELECT FROM pg_catalog.pg_policies 
        WHERE tablename = 'kait_workflows' AND policyname = 'Enable read access for all users'
    ) THEN
        CREATE POLICY "Enable read access for all users" ON public.kait_workflows FOR SELECT USING (true);
    END IF;

    -- Policy: Enable insert access for all users
    IF NOT EXISTS (
        SELECT FROM pg_catalog.pg_policies 
        WHERE tablename = 'kait_workflows' AND policyname = 'Enable insert access for all users'
    ) THEN
        CREATE POLICY "Enable insert access for all users" ON public.kait_workflows FOR INSERT WITH CHECK (true);
    END IF;

    -- Policy: Enable update access for all users
    IF NOT EXISTS (
        SELECT FROM pg_catalog.pg_policies 
        WHERE tablename = 'kait_workflows' AND policyname = 'Enable update access for all users'
    ) THEN
        CREATE POLICY "Enable update access for all users" ON public.kait_workflows FOR UPDATE USING (true);
    END IF;
END
$$;
