# Test Email Templates

Send these emails to: **support@audicoonline.co.za**

---

## Test 1: Order Status Query

**Subject:** Where is my order?

**Body:**
```
Hi,

I placed order #12345 last week but haven't received any updates.
Can you please check the status and let me know when it will arrive?

Thanks,
John
```

**Expected Category:** ORDER_STATUS_QUERY

---

## Test 2: Product Question

**Subject:** Question about Sony headphones

**Body:**
```
Hi,

I'm interested in the Sony WH-1000XM5 headphones.
Do they work with Xbox Series X?
Also, do you have them in stock?

Thanks
```

**Expected Category:** PRODUCT_QUESTION

---

## Test 3: Quote Request

**Subject:** Quote for office setup

**Body:**
```
Hello,

Can you please provide a quote for:
- 5x Logitech webcams
- 3x Blue Yeti microphones
- 10x wireless headsets

For delivery to Johannesburg.

Thanks
```

**Expected Category:** QUOTE_REQUEST

---

## Test 4: Complaint

**Subject:** Disappointed with service

**Body:**
```
Hi,

I received the wrong item in my order #18593.
I ordered a wireless headset but received wired earbuds instead.

I've been trying to contact customer service for 3 days with no response.
This is very frustrating.

Please help resolve this urgently.
```

**Expected Category:** COMPLAINT

---

## Test 5: General Inquiry

**Subject:** Store hours

**Body:**
```
Hi,

What are your store opening hours?
Do you offer in-store pickup?

Thanks
```

**Expected Category:** GENERAL_OTHER

---

## Test 6: Invoice Request

**Subject:** Need invoice for order 19919

**Body:**
```
Hi,

Can you please send me the invoice for order #19919?
I need it for my company records.

Thanks
Sarah
```

**Expected Category:** INVOICE_REQUEST

---

## How to Test

1. **Start the server:**
   - Double-click `START_SERVER.bat` OR
   - Run: `python -m src.main`

2. **Send one of the test emails above** to support@audicoonline.co.za

3. **Wait 60 seconds** (or trigger manually):
   ```bash
   curl -X POST http://localhost:8000/email/poll
   ```

4. **Check Gmail drafts** - Should have a new draft response

5. **Check Supabase logs:**
   - Go to: https://supabase.com/dashboard/project/ajdehycoypilsegmxbto
   - View `email_logs` table
   - View `agent_logs` table

---

## What to Look For

### In Gmail Drafts
- Subject: "Re: [original subject]"
- Body: Generated response from Claude/GPT
- Should be professional and relevant to the category

### In Supabase email_logs Table
- `gmail_message_id`: Unique Gmail ID
- `category`: Classified category
- `classification_confidence`: Should be > 0.85
- `status`: Should be "DRAFTED"
- `draft_content`: The generated response
- `handled_by_agent`: "EmailManagementAgent"

### In Supabase agent_logs Table
- Multiple entries showing processing steps:
  - "email_fetched"
  - "email_classified"
  - "email_processed"

### In Console Logs (Server Terminal)
JSON formatted logs showing:
```json
{"level": "INFO", "agent": "EmailManagementAgent", "event": "email_classified", "category": "ORDER_STATUS_QUERY", "confidence": 0.92}
```

---

## Success Criteria

✅ Email is processed without errors
✅ Classification is accurate
✅ Draft is created in Gmail
✅ Logs appear in Supabase
✅ Console shows structured JSON logs
✅ Draft content is relevant and professional

---

## Notes

- **Stage 1 = Draft Only**: No emails are sent automatically
- All drafts require human approval
- OpenCart/Shiplogic errors are expected (not fully integrated in Stage 1)
- Order numbers (#12345) are extracted automatically
- Confidence threshold: 0.85 (configurable)
