-- MCP Sync Session and Log Tables
-- Tracks automated MCP supplier feed syncs

-- Sync sessions table
CREATE TABLE IF NOT EXISTS mcp_sync_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    status TEXT CHECK (status IN ('running', 'completed', 'partial', 'failed')),
    total_suppliers INTEGER DEFAULT 0,
    completed_suppliers INTEGER DEFAULT 0,
    failed_suppliers INTEGER DEFAULT 0,
    triggered_by TEXT DEFAULT 'cron',
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_mcp_sync_sessions_started ON mcp_sync_sessions(started_at DESC);

-- Sync log table (per supplier)
CREATE TABLE IF NOT EXISTS mcp_sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES mcp_sync_sessions(id),
    supplier_name TEXT NOT NULL,
    status TEXT CHECK (status IN ('success', 'failed', 'error')),
    duration_seconds NUMERIC(10,2),
    output TEXT,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mcp_sync_log_session ON mcp_sync_log(session_id);
CREATE INDEX IF NOT EXISTS idx_mcp_sync_log_supplier ON mcp_sync_log(supplier_name);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON mcp_sync_sessions TO authenticated;
GRANT SELECT, INSERT ON mcp_sync_log TO authenticated;

GRANT SELECT, INSERT, UPDATE ON mcp_sync_sessions TO anon;
GRANT SELECT, INSERT ON mcp_sync_log TO anon;
