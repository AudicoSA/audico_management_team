-- KAIT MEMORIES & FEEDBACK LOOP
-- Phase 5: Education System

-- 1. Create Memories Table
-- Stores "Facts" Kait has learned, e.g. "Brand: Sonos" -> "Supplier: Planetworld"
CREATE TABLE public.kait_memories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category TEXT NOT NULL, -- 'supplier_mapping', 'preference', 'correction'
    key_pattern TEXT NOT NULL, -- e.g. 'brand:sonos' or 'email_style'
    value TEXT NOT NULL, -- e.g. 'Planetworld' or 'formal'
    confidence FLOAT DEFAULT 1.0, -- Manual teaching = 1.0
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.kait_memories ENABLE ROW LEVEL SECURITY;

-- Permissions (Open for Dashboard/Service)
CREATE POLICY "Allow All for Anon" ON public.kait_memories FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow All for Service" ON public.kait_memories FOR ALL TO service_role USING (true) WITH CHECK (true);
GRANT ALL ON TABLE public.kait_memories TO anon;
GRANT ALL ON TABLE public.kait_memories TO service_role;

-- 2. Update Drafts Table for Feedback
ALTER TABLE public.kait_email_drafts 
ADD COLUMN feedback TEXT, -- User instruction: "Sonos is supplied by Planetworld"
ADD COLUMN retry_count INT DEFAULT 0;

-- 3. Notify Trigger (Optional, but good for realtime)
ALTER PUBLICATION supabase_realtime ADD TABLE public.kait_memories;
