-- Migration: Conversation History Persistence
-- Purpose: Store AI conversation history to survive server restarts
-- Date: 2026-01-26

-- Create conversation_history table
CREATE TABLE IF NOT EXISTS conversation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE,
  message_index INT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_conversation_history_session ON conversation_history(session_id);
CREATE INDEX idx_conversation_history_quote ON conversation_history(quote_id);
CREATE INDEX idx_conversation_history_created ON conversation_history(created_at);

-- Create composite index for efficient loading
CREATE INDEX idx_conversation_history_session_index ON conversation_history(session_id, message_index);

-- Add comment
COMMENT ON TABLE conversation_history IS 'Stores conversation history for AI chat sessions to survive server restarts';

-- Optional: Create function to clean up old conversations (7+ days old)
CREATE OR REPLACE FUNCTION cleanup_old_conversations()
RETURNS void AS $$
BEGIN
  DELETE FROM conversation_history
  WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Optional: You can schedule this to run nightly using pg_cron or a cron job
-- COMMENT: Run this manually or set up a scheduled job:
-- SELECT cleanup_old_conversations();
