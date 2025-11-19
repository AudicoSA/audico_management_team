# Audico AI Executive Management System

Multi-agent AI system for automating e-commerce operations at Audico Online.

## Stage 1 - Email Management MVP

**Status:** Ready for setup and testing
**Components:** EmailManagementAgent, Gmail connector, Supabase logging, draft-only mode

---

## Quick Start

### 1. Prerequisites

- **Python 3.11+**
- **Supabase project** (already configured at `https://ajdehycoypilsegmxbto.supabase.co`)
- **Gmail OAuth credentials** (refresh token already obtained)
- **API keys** for OpenAI and Anthropic (in `.env`)

### 2. Installation

```bash
# Navigate to project directory
cd "D:\AudicoAI\Audico Management Team\audico-ai"

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Upgrade pip first
python -m pip install --upgrade pip

# Install core dependencies
pip install -r requirements.txt

# (Optional) Install development/testing tools
pip install -r requirements-dev.txt
```

### 3. Environment Setup

Your `.env` file is already configured in the parent directory with all required credentials:
- ✅ Gmail OAuth (refresh token)
- ✅ OpenAI API key
- ✅ Anthropic API key
- ✅ Supabase URL and keys
- ✅ OpenCart credentials
- ✅ Shiplogic API key

The system will automatically load from `../.env` relative to the `audico-ai` directory.

### 4. Database Setup

Run migrations to create Supabase tables:

```bash
# Run migrations
python -m src.db.run_migrations
```

This creates:
- `agent_logs` - Agent event logging
- `email_logs` - Email processing tracking
- `orders_tracker` - Order management (Excel mirror)
- `order_shipments` - Shipment tracking
- `config` - System configuration

### 5. Start the System

```bash
# Run the FastAPI server
python -m src.main

# Or with uvicorn directly:
uvicorn src.main:app --reload --port 8000
```

The system will:
- Start FastAPI server on http://localhost:8000
- Begin polling Gmail every 60 seconds
- Process unread emails automatically
- Create drafts in Gmail (no auto-send in Stage 1)

---

## API Endpoints

### Health & Status

```bash
# Check system health
GET http://localhost:8000/health

# Get configuration
GET http://localhost:8000/config
```

### Email Operations

```bash
# Manually trigger email poll
POST http://localhost:8000/email/poll

# Process specific email
POST http://localhost:8000/email/process/{message_id}
```

### Agent Control

```bash
# Enable/disable agent
POST http://localhost:8000/config/agent/{agent_name}/toggle
Body: {"enabled": true}
```

---

## How It Works (Stage 1)

### Email Processing Flow

1. **Poll Gmail** - Fetch unread emails from `support@audicoonline.co.za`
2. **Classify** - Use LLM to categorize email into:
   - NEW_ORDER_NOTIFICATION
   - ORDER_STATUS_QUERY
   - PRODUCT_QUESTION
   - QUOTE_REQUEST
   - SUPPLIER_INVOICE
   - COMPLAINT
   - GENERAL_OTHER
   - SPAM
3. **Gather Context** - Fetch order info from OpenCart if needed
4. **Draft Response** - Generate response using LLM with context
5. **Create Draft** - Save as Gmail draft (requires human approval)
6. **Log Everything** - Record to Supabase for audit and dashboard

### Draft-Only Mode

**Stage 1 operates in draft-only mode:**
- All responses saved as Gmail drafts
- No automatic sending
- Human approval required via Gmail or future dashboard
- Safety net for testing and validation

---

## Testing

### Manual Test Flow

1. **Send test email** to `support@audicoonline.co.za`
2. **Wait 60 seconds** for polling (or trigger manually)
3. **Check Gmail drafts** for generated response
4. **Check Supabase** `email_logs` table for processing record
5. **Check Supabase** `agent_logs` for detailed event log

### Test Email Templates

**Order Status Query:**
```
Subject: Where is my order?
Body: Hi, I ordered a headset (order #12345) last week and haven't received it yet. Can you check the status?
```

**Product Question:**
```
Subject: Question about Sony headphones
Body: Do the Sony WH-1000XM5 headphones work with Xbox Series X?
```

**Complaint:**
```
Subject: Disappointed with service
Body: I received the wrong item and customer service hasn't responded to my emails.
```

### Run Unit Tests

```bash
# Install test dependencies (if not already installed)
pip install -r requirements-dev.txt

# Run all tests
pytest tests/ -v

# Run specific test file
pytest tests/test_connectors.py -v

# Run with coverage
pytest tests/ --cov=src --cov-report=html
```

---

## Project Structure

```
audico-ai/
├── src/
│   ├── main.py                  # FastAPI entrypoint
│   ├── agents/
│   │   └── email_agent.py       # EmailManagementAgent
│   ├── connectors/
│   │   ├── gmail.py            # Gmail API (OAuth2)
│   │   ├── opencart.py         # OpenCart REST API
│   │   ├── supabase.py         # Supabase operations
│   │   └── shiplogic.py        # Shiplogic (stub for Stage 1)
│   ├── models/
│   │   └── llm_client.py       # LLM abstraction (OpenAI + Anthropic)
│   ├── utils/
│   │   ├── config.py           # Configuration loader
│   │   └── logging.py          # Structured logging
│   └── db/
│       ├── migrations/
│       │   └── 001_init.sql    # Initial schema
│       └── run_migrations.py   # Migration runner
├── tests/
│   ├── test_connectors.py
│   └── test_email_flow.py
├── requirements.txt
├── pyproject.toml
└── README.md
```

---

## Configuration

### Email Classification Threshold

Minimum confidence for automatic classification (default: 0.85)

```python
# In config table:
email_classification_threshold = 0.85
```

### Polling Interval

How often to check Gmail for new messages (default: 60 seconds)

```python
gmail_polling_interval_seconds = 60
```

### Model Routing

Which LLM to use for each task:

```json
{
  "classification": "gpt-4o-mini",
  "email_draft": "claude-3-5-sonnet-20241022",
  "cs_reply": "claude-3-5-sonnet-20241022"
}
```

---

## Monitoring & Logs

### Structured Logging

All logs output as JSON with trace IDs:

```json
{
  "timestamp": "2025-11-17T12:34:56Z",
  "level": "INFO",
  "agent": "EmailManagementAgent",
  "event": "email_classified",
  "trace_id": "550e8400-e29b-41d4-a716-446655440000",
  "category": "ORDER_STATUS_QUERY",
  "confidence": 0.92
}
```

### Supabase Tables

**View logs in Supabase:**
1. Go to https://supabase.com/dashboard
2. Select project: `ajdehycoypilsegmxbto`
3. Navigate to "Table Editor"
4. View `agent_logs` and `email_logs`

### Key Metrics

- Classification accuracy: Check `classification_confidence` in `email_logs`
- Processing time: Compare `created_at` to `updated_at` in `email_logs`
- Error rate: Count `ERROR` level entries in `agent_logs`

---

## Troubleshooting

### Gmail OAuth Error

```
Error: invalid_grant or token expired
```

**Solution:** Re-run the Gmail refresh token script:

```bash
python ../fetch_gmail_refresh_token.py
```

Then update `GMAIL_REFRESH_TOKEN` in `.env`.

### Supabase Connection Error

```
Error: Could not connect to Supabase
```

**Solution:** Verify credentials:

```bash
# Check Supabase URL and keys in .env
echo $SUPABASE_URL
echo $SUPABASE_SERVICE_ROLE_KEY
```

### LLM API Error

```
Error: 401 Unauthorized
```

**Solution:** Verify API keys:

```bash
# Test OpenAI key
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"

# Test Anthropic key
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY"
```

### No Emails Being Processed

**Checklist:**
1. Check Gmail has unread emails in inbox
2. Verify polling interval in config
3. Check logs for errors: `tail -f logs/app.log`
4. Manually trigger poll: `POST http://localhost:8000/email/poll`

---

## Next Steps

### Stage 1 Validation (Current)

- [ ] Run migrations successfully
- [ ] Start system without errors
- [ ] Process 10 test emails
- [ ] Verify 100% draft creation
- [ ] Check Supabase logs populated
- [ ] Validate classification accuracy >90%

### Stage 2 Preview (Orders & Logistics)

- OrdersLogisticsAgent implementation
- Shiplogic live integration
- Excel → Supabase migration
- Dashboard MVP (Next.js)

---

## Support

**Documentation:**
- [CLAUDE.md](../CLAUDE.md) - Comprehensive guide
- [Stage 0 Report](../STAGE_0_COMPLETION_REPORT.md) - Research findings
- [Technical Plan](../TECHNICAL_DELIVERY_PLAN.md) - Full architecture

**Contact:**
- Kenny (Audico Online): kenny@audico.co.za

---

## License

Proprietary - Audico Online (Pty) Ltd
