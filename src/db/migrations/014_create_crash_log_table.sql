-- MCP Crash Log Table
-- Captures critical failures in MCP scrapers (e.g., Playwright unavailable, browser launch failures)

CREATE TABLE IF NOT EXISTS mcp_crash_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_name TEXT NOT NULL,
    error_type TEXT NOT NULL,
    error_message TEXT NOT NULL,
    stack_trace TEXT,
    context JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_mcp_crash_log_supplier ON mcp_crash_log(supplier_name);
CREATE INDEX IF NOT EXISTS idx_mcp_crash_log_created ON mcp_crash_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mcp_crash_log_error_type ON mcp_crash_log(error_type);

-- Grant permissions
GRANT SELECT, INSERT ON mcp_crash_log TO authenticated;
GRANT SELECT, INSERT ON mcp_crash_log TO anon;
