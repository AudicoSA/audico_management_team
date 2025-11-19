# Setting Up Credentials for Audico AI

## Quick Start

1. Copy the example environment file:
   ```bash
   copy .env.example .env
   ```

2. Fill in your actual credentials in the `.env` file

3. Run the import script to get real data:
   ```bash
   python import_opencart_orders.py --days 30 --limit 50
   ```

---

## Required Credentials

### 1. OpenCart API Access

You need either:
- **Option A: REST API credentials** (recommended)
- **Option B: Direct database access** (fallback)

#### Option A: REST API Setup

1. Log into your OpenCart admin panel: https://audicoonline.co.za/admin
2. Go to: **System** → **Users** → **API**
3. Create or edit an API user
4. Note the **Username** and generate a new **Key**

Then in `.env`:
```env
OPENCART_BASE_URL=https://audicoonline.co.za
OPENCART_API_USERNAME=your_api_username
OPENCART_API_KEY=your_api_key_here
```

#### Option B: Database Access

If REST API isn't available, use direct database access:

```env
OPENCART_DB_HOST=your_mysql_host
OPENCART_DB_PORT=3306
OPENCART_DB_NAME=your_database_name
OPENCART_DB_USER=your_db_username
OPENCART_DB_PASSWORD=your_db_password
```

### 2. Supabase (Already configured)

```env
SUPABASE_URL=https://ajdehycoypilsegmxbto.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

Get service role key from: https://supabase.com/dashboard/project/ajdehycoypilsegmxbto/settings/api

### 3. LLM API Keys

```env
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

### 4. Gmail API (for email monitoring)

This requires OAuth setup. Run this helper:
```bash
python src/utils/fetch_gmail_refresh_token.py
```

It will guide you through:
1. Uploading your OAuth client JSON
2. Authorizing the app
3. Generating a refresh token

Then add to `.env`:
```env
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
GMAIL_REFRESH_TOKEN=...
```

### 5. Shiplogic API

You mentioned you already have this:
```env
SHIPLOGIC_API_KEY=your_existing_key
```

---

## Testing the Connection

### Test OpenCart Connection

```bash
python -c "
import asyncio
from src.connectors.opencart import OpenCartConnector

async def test():
    oc = OpenCartConnector()
    orders = await oc.get_recent_orders(limit=5)
    print(f'Found {len(orders)} orders')
    for o in orders[:3]:
        print(f'  Order #{o.get(\"order_id\")}: {o.get(\"status_name\")}')

asyncio.run(test())
"
```

### Import Real Orders

```bash
python import_opencart_orders.py --days 30 --limit 50
```

This will:
- Fetch the last 30 days of orders from OpenCart
- Import them into your dashboard
- Show you real data instead of fake samples

---

## Priority: Start with OpenCart

To get real data flowing, focus on **OpenCart credentials first**. This will:

1. Show real orders in your dashboard
2. Give the AI real context to learn from
3. Let us train the email agent with actual order data

Once you have OpenCart connected, we can:
1. Import real orders
2. Feed real customer emails to the AI
3. Train it to understand your specific:
   - Product names
   - Supplier relationships
   - Customer communication patterns

---

## Need Help?

If you're not sure how to get any credentials:
1. Let me know which one
2. I'll guide you step-by-step through the admin panels
