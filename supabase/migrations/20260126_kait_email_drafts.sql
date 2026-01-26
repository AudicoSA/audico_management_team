-- KAIT EMAIL DRAFTS / OUTBOX
-- Stores generated emails for human review before sending.

CREATE TABLE public.kait_email_drafts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_no TEXT NOT NULL,
    to_email TEXT NOT NULL,
    cc_emails TEXT[] DEFAULT '{}',
    subject TEXT NOT NULL,
    body_text TEXT NOT NULL,
    body_html TEXT,
    status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'approved', 'sent', 'rejected'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sent_at TIMESTAMP WITH TIME ZONE,
    error_log TEXT,
    message_id TEXT, -- The final Message-ID after sending
    metadata JSONB DEFAULT '{}'::jsonb
);

-- RLS: Open for now for Key access
ALTER TABLE public.kait_email_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow All for Anon" ON public.kait_email_drafts
FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow All for Service" ON public.kait_email_drafts
FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.kait_email_drafts;
