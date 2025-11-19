# Future Agent Queries

## For Stage 2/3: OrdersLogisticsAgent & StockListingsAgent

These queries show how future agents can access supplier emails that have been logged.

### Find All Supplier Invoices Pending Processing

```sql
SELECT
    id,
    created_at,
    from_email,
    subject,
    gmail_message_id,
    payload->>'has_attachments' as has_attachments,
    payload->>'attachment_count' as attachment_count
FROM email_logs
WHERE category = 'SUPPLIER_INVOICE'
  AND status = 'CLASSIFIED'  -- Supplier emails kept as CLASSIFIED for future processing
  AND handled_by_agent = 'EmailManagementAgent'
ORDER BY created_at DESC;
```

### Find All Supplier Pricelists

```sql
SELECT
    id,
    created_at,
    from_email,
    subject,
    gmail_message_id,
    payload->>'has_attachments' as has_attachments
FROM email_logs
WHERE category = 'SUPPLIER_PRICELIST'
  AND status = 'CLASSIFIED'  -- Supplier emails kept as CLASSIFIED for future processing
ORDER BY created_at DESC;
```

### Find All Supplier Communications (General)

```sql
SELECT
    id,
    created_at,
    from_email,
    subject,
    category,
    gmail_message_id
FROM email_logs
WHERE category IN ('SUPPLIER_COMMUNICATION', 'SUPPLIER_INVOICE', 'SUPPLIER_PRICELIST')
ORDER BY created_at DESC
LIMIT 50;
```

### Check Agent Logs for Supplier Emails

```sql
SELECT
    created_at,
    agent,
    event_type,
    context->>'message_id' as message_id,
    context->>'category' as category,
    context->>'from_email' as from_email,
    context->>'subject' as subject,
    context->>'has_attachments' as has_attachments,
    context->>'requires_future_processing' as requires_processing
FROM agent_logs
WHERE event_type = 'supplier_email_logged'
  AND context->>'requires_future_processing' = 'true'
ORDER BY created_at DESC;
```

## Python Code for Future Agents

### Example: OrdersLogisticsAgent Processing Supplier Invoices

```python
from src.connectors.supabase import get_supabase_connector
from src.connectors.gmail import get_gmail_connector

async def process_supplier_invoices():
    """Find and process supplier invoices."""
    supabase = get_supabase_connector()
    gmail = get_gmail_connector()

    # Find pending supplier invoices
    response = supabase.client.table('email_logs') \
        .select('*') \
        .eq('category', 'SUPPLIER_INVOICE') \
        .eq('status', 'CLASSIFIED') \
        .eq('handled_by_agent', 'EmailManagementAgent') \
        .execute()

    for email_log in response.data:
        message_id = email_log['gmail_message_id']

        # Fetch full email with attachments
        email = gmail.get_message(message_id)

        # Download attachments (PDFs, Excel, etc.)
        if email.has_attachments:
            # TODO: Download and process invoice
            # Extract: Order number, amount, supplier name
            # Update: orders_tracker table
            pass

        # Mark as processed
        await supabase.update_email_log(
            gmail_message_id=message_id,
            status='PROCESSED',
            handled_by_agent='OrdersLogisticsAgent'
        )
```

### Example: StockListingsAgent Processing Pricelists

```python
async def process_supplier_pricelists():
    """Find and process supplier pricelists."""
    supabase = get_supabase_connector()
    gmail = get_gmail_connector()

    # Find pending pricelists
    response = supabase.client.table('email_logs') \
        .select('*') \
        .eq('category', 'SUPPLIER_PRICELIST') \
        .eq('status', 'CLASSIFIED') \
        .execute()

    for email_log in response.data:
        message_id = email_log['gmail_message_id']

        # Fetch full email with attachments
        email = gmail.get_message(message_id)

        # Download CSV/Excel pricelist
        if email.has_attachments:
            # TODO: Download and process pricelist
            # Parse: Product codes, prices, stock levels
            # Update: OpenCart products
            pass

        # Mark as processed
        await supabase.update_email_log(
            gmail_message_id=message_id,
            status='PROCESSED',
            handled_by_agent='StockListingsAgent'
        )
```

## Gmail Labels Created

The system automatically applies these Gmail labels:

- `agent_processed` - All processed emails
- `supplier_invoice` - Emails classified as supplier invoices
- `supplier_pricelist` - Emails classified as supplier pricelists
- `supplier_communication` - General supplier communications

**In Gmail, you can:**
1. View all invoices: Search for `label:supplier_invoice`
2. View pricelists: Search for `label:supplier_pricelist`
3. View with attachments: `label:supplier_invoice has:attachment`

## Database Schema Reference

### email_logs table

Key fields for supplier emails:
- `category` - 'SUPPLIER_INVOICE', 'SUPPLIER_PRICELIST', 'SUPPLIER_COMMUNICATION'
- `status` - 'PENDING_AGENT_REVIEW' for supplier emails requiring processing
- `gmail_message_id` - Use this to fetch full email from Gmail
- `payload` - JSONB with `has_attachments`, `attachment_count`, etc.
- `from_email` - Supplier email address

### agent_logs table

Key fields:
- `event_type` - 'supplier_email_logged' for supplier emails
- `context` - JSONB with all email metadata
- `context->>'requires_future_processing'` - 'true' for invoices/pricelists

## Future Enhancements

1. **Attachment Downloads**: Add function to download email attachments to temp storage
2. **Supplier Matching**: Match `from_email` to `suppliers` table
3. **Duplicate Detection**: Check if invoice already processed (based on invoice number)
4. **Validation**: Verify invoice amounts, order numbers before updating spreadsheet
5. **Human Review Queue**: Flag uncertain invoices for manual review
