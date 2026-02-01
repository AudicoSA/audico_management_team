-- Audico AI System - Initial Schema
-- Stage 1: Core tables for Email Management MVP

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Helper function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==============================================
-- 1. AGENT_LOGS TABLE
-- ==============================================
CREATE TABLE IF NOT EXISTS agent_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  agent TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL')),
  event_type TEXT NOT NULL,
  trace_id UUID,
  context JSONB,
  CONSTRAINT agent_logs_agent_check CHECK (agent IN (
    'EmailManagementAgent',
    'OrdersLogisticsAgent',
    'StockListingsAgent',
    'CustomerServiceAgent',
    'SocialMediaAgent',
    'Orchestrator'
  ))
);

CREATE INDEX idx_agent_logs_created_at ON agent_logs(created_at DESC);
CREATE INDEX idx_agent_logs_agent ON agent_logs(agent);
CREATE INDEX idx_agent_logs_trace_id ON agent_logs(trace_id);
CREATE INDEX idx_agent_logs_level ON agent_logs(level) WHERE level IN ('ERROR', 'CRITICAL');

-- ==============================================
-- 2. EMAIL_LOGS TABLE
-- ==============================================
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Gmail identifiers
  gmail_message_id TEXT UNIQUE NOT NULL,
  gmail_thread_id TEXT,

  -- Email metadata
  from_email TEXT NOT NULL,
  to_email TEXT NOT NULL,
  subject TEXT,
  category TEXT NOT NULL CHECK (category IN (
    'NEW_ORDER_NOTIFICATION',
    'ORDER_STATUS_QUERY',
    'PRODUCT_QUESTION',
    'QUOTE_REQUEST',
    'INVOICE_REQUEST',
    'SUPPLIER_INVOICE',
    'SUPPLIER_PRICELIST',
    'COMPLAINT',
    'GENERAL_OTHER',
    'SPAM'
  )),
  classification_confidence NUMERIC(3,2),

  -- Processing status
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN (
    'PENDING',
    'CLASSIFIED',
    'DRAFTED',
    'APPROVED',
    'SENT',
    'ESCALATED',
    'REJECTED'
  )),
  handled_by_agent TEXT,
  draft_content TEXT,
  sent_message_id TEXT,

  -- Metadata
  has_attachments BOOLEAN DEFAULT FALSE,
  attachment_count INT DEFAULT 0,
  order_numbers TEXT[], -- Extracted order references
  payload JSONB,

  -- Audit
  trace_id UUID,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  rejected_reason TEXT
);

CREATE INDEX idx_email_logs_created_at ON email_logs(created_at DESC);
CREATE INDEX idx_email_logs_gmail_message_id ON email_logs(gmail_message_id);
CREATE INDEX idx_email_logs_status ON email_logs(status);
CREATE INDEX idx_email_logs_category ON email_logs(category);
CREATE INDEX idx_email_logs_gmail_thread_id ON email_logs(gmail_thread_id);

CREATE TRIGGER update_email_logs_updated_at
  BEFORE UPDATE ON email_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==============================================
-- 3. ORDERS_TRACKER TABLE (Excel Mirror)
-- ==============================================
CREATE TABLE IF NOT EXISTS orders_tracker (
  order_no TEXT PRIMARY KEY, -- OpenCart order ID
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Order details
  order_name TEXT,
  supplier TEXT,
  notes TEXT,

  -- Financial fields
  cost NUMERIC(10,2),
  invoice_no TEXT,
  order_paid BOOLEAN DEFAULT FALSE,
  supplier_amount NUMERIC(10,2),
  shipping NUMERIC(10,2),
  profit NUMERIC(10,2),

  -- Status updates
  updates TEXT,

  -- Owner flags (color coding from Excel)
  owner_wade BOOLEAN DEFAULT FALSE,
  owner_lucky BOOLEAN DEFAULT FALSE,
  owner_kenny BOOLEAN DEFAULT FALSE,
  owner_accounts BOOLEAN DEFAULT FALSE,
  flag_done BOOLEAN DEFAULT FALSE,
  flag_urgent BOOLEAN DEFAULT FALSE,

  -- Metadata
  source TEXT DEFAULT 'excel' CHECK (source IN ('excel', 'opencart', 'agent', 'dashboard')),
  last_modified_by TEXT,

  -- Soft delete
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_orders_tracker_updated_at ON orders_tracker(updated_at DESC);
CREATE INDEX idx_orders_tracker_supplier ON orders_tracker(supplier);
CREATE INDEX idx_orders_tracker_owner_wade ON orders_tracker(owner_wade) WHERE owner_wade = TRUE;
CREATE INDEX idx_orders_tracker_owner_lucky ON orders_tracker(owner_lucky) WHERE owner_lucky = TRUE;
CREATE INDEX idx_orders_tracker_owner_kenny ON orders_tracker(owner_kenny) WHERE owner_kenny = TRUE;
CREATE INDEX idx_orders_tracker_flag_urgent ON orders_tracker(flag_urgent) WHERE flag_urgent = TRUE;
CREATE INDEX idx_orders_tracker_flag_done ON orders_tracker(flag_done) WHERE flag_done = FALSE;

CREATE TRIGGER update_orders_tracker_updated_at
  BEFORE UPDATE ON orders_tracker
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==============================================
-- 4. ORDERS_TRACKER_HISTORY TABLE (Audit Log)
-- ==============================================
CREATE TABLE IF NOT EXISTS orders_tracker_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_no TEXT NOT NULL REFERENCES orders_tracker(order_no),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by TEXT NOT NULL,
  change_source TEXT NOT NULL CHECK (change_source IN ('dashboard', 'agent', 'migration', 'api')),

  -- Snapshot of changes
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,

  -- Context
  trace_id UUID,
  reason TEXT
);

CREATE INDEX idx_orders_tracker_history_order_no ON orders_tracker_history(order_no);
CREATE INDEX idx_orders_tracker_history_changed_at ON orders_tracker_history(changed_at DESC);

-- Trigger to log all changes to orders_tracker
CREATE OR REPLACE FUNCTION log_orders_tracker_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Log significant field changes
  IF OLD.order_name IS DISTINCT FROM NEW.order_name THEN
    INSERT INTO orders_tracker_history (order_no, changed_by, change_source, field_name, old_value, new_value)
    VALUES (NEW.order_no, NEW.last_modified_by, NEW.source, 'order_name', OLD.order_name, NEW.order_name);
  END IF;

  IF OLD.supplier IS DISTINCT FROM NEW.supplier THEN
    INSERT INTO orders_tracker_history (order_no, changed_by, change_source, field_name, old_value, new_value)
    VALUES (NEW.order_no, NEW.last_modified_by, NEW.source, 'supplier', OLD.supplier, NEW.supplier);
  END IF;

  IF OLD.cost IS DISTINCT FROM NEW.cost THEN
    INSERT INTO orders_tracker_history (order_no, changed_by, change_source, field_name, old_value, new_value)
    VALUES (NEW.order_no, NEW.last_modified_by, NEW.source, 'cost', OLD.cost::TEXT, NEW.cost::TEXT);
  END IF;

  IF OLD.shipping IS DISTINCT FROM NEW.shipping THEN
    INSERT INTO orders_tracker_history (order_no, changed_by, change_source, field_name, old_value, new_value)
    VALUES (NEW.order_no, NEW.last_modified_by, NEW.source, 'shipping', OLD.shipping::TEXT, NEW.shipping::TEXT);
  END IF;

  IF OLD.profit IS DISTINCT FROM NEW.profit THEN
    INSERT INTO orders_tracker_history (order_no, changed_by, change_source, field_name, old_value, new_value)
    VALUES (NEW.order_no, NEW.last_modified_by, NEW.source, 'profit', OLD.profit::TEXT, NEW.profit::TEXT);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER log_orders_tracker_changes_trigger
  AFTER UPDATE ON orders_tracker
  FOR EACH ROW EXECUTE FUNCTION log_orders_tracker_changes();

-- ==============================================
-- 5. ORDER_SHIPMENTS TABLE
-- ==============================================
CREATE TABLE IF NOT EXISTS order_shipments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Order reference
  order_no TEXT NOT NULL REFERENCES orders_tracker(order_no),

  -- Shiplogic identifiers
  shiplogic_shipment_id TEXT UNIQUE,
  short_tracking_reference TEXT,
  tcg_waybill TEXT,
  tracking_url TEXT,

  -- Shipment details
  courier TEXT,
  service_level TEXT,
  parcel_count INT DEFAULT 1,
  weight_kg NUMERIC(6,2),

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'booked',
    'collected',
    'in_transit',
    'out_for_delivery',
    'delivered',
    'failed',
    'cancelled',
    'returned'
  )),
  last_status_update TIMESTAMPTZ,

  -- Cost
  shipping_cost NUMERIC(10,2),
  currency TEXT DEFAULT 'ZAR',

  -- Metadata
  payload JSONB, -- Full Shiplogic API response
  webhook_payload JSONB, -- Latest webhook data

  -- Soft delete
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_order_shipments_order_no ON order_shipments(order_no);
CREATE INDEX idx_order_shipments_status ON order_shipments(status);
CREATE INDEX idx_order_shipments_shiplogic_id ON order_shipments(shiplogic_shipment_id);

CREATE TRIGGER update_order_shipments_updated_at
  BEFORE UPDATE ON order_shipments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==============================================
-- 6. ORDER_SHIPMENTS_HISTORY TABLE
-- ==============================================
CREATE TABLE IF NOT EXISTS order_shipments_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shipment_id UUID NOT NULL REFERENCES order_shipments(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Status change
  old_status TEXT,
  new_status TEXT NOT NULL,

  -- Source
  source TEXT NOT NULL CHECK (source IN ('webhook', 'api_poll', 'manual')),

  -- Context
  payload JSONB
);

CREATE INDEX idx_order_shipments_history_shipment_id ON order_shipments_history(shipment_id);
CREATE INDEX idx_order_shipments_history_changed_at ON order_shipments_history(changed_at DESC);

-- ==============================================
-- 7. CONFIG TABLE
-- ==============================================
CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT
);

CREATE TRIGGER update_config_updated_at
  BEFORE UPDATE ON config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed initial configuration
INSERT INTO config (key, value, description) VALUES
('email_classification_threshold', '0.85', 'Minimum confidence for email classification'),
('approval_thresholds', '{"supplier_order": 5000, "shiplogic_booking": 500, "refund": 2000, "price_increase_pct": 10, "price_decrease_pct": 20}', 'Approval gate thresholds in ZAR or %'),
('agent_enabled', '{"EmailManagementAgent": true, "OrdersLogisticsAgent": false, "StockListingsAgent": false, "CustomerServiceAgent": false, "SocialMediaAgent": false}', 'Agent enable/disable flags'),
('email_draft_mode', 'true', 'If true, all emails saved as drafts (Stage 1 default)'),
('llm_model_routing', '{"classification": "gpt-4o-mini", "email_draft": "claude-3-5-sonnet-20241022", "cs_reply": "claude-3-5-sonnet-20241022"}', 'Model selection per task'),
('shiplogic_default_service', '"Express"', 'Default Shiplogic service level'),
('gmail_polling_interval_seconds', '60', 'How often to poll Gmail'),
('webhook_endpoints', '{"shiplogic": "/webhooks/shiplogic"}', 'Webhook URLs'),
('business_hours', '{"start": "08:00", "end": "17:00", "timezone": "Africa/Johannesburg", "days": ["Mon", "Tue", "Wed", "Thu", "Fri"]}', 'Business hours for SLA calculations')
ON CONFLICT (key) DO NOTHING;
