# Stage 1 Testing Checklist

## Pre-Flight Check

- [ ] Virtual environment created (`venv` folder exists)
- [ ] Dependencies installed (`pip install -r requirements.txt` completed)
- [ ] `.env` file exists in parent directory
- [ ] Supabase tables created (ran 001_init.sql)

---

## Server Startup Test

- [ ] **Start server:** Double-click `START_SERVER.bat` (or run `python -m src.main`)
- [ ] **Check console:** No errors, shows "Uvicorn running on http://0.0.0.0:8000"
- [ ] **Check health:** Open http://localhost:8000/health in browser
- [ ] **Expected response:**
  ```json
  {
    "status": "healthy",
    "environment": "development",
    "agents": {
      "EmailManagementAgent": true
    }
  }
  ```

---

## Email Processing Test

### Step 1: Send Test Email
- [ ] Send email to: support@audicoonline.co.za
- [ ] Use template from `TEST_EMAILS.md` (e.g., "Where is my order?")
- [ ] Note the time sent

### Step 2: Trigger Processing
Choose one:
- [ ] **Option A:** Wait 60 seconds for automatic polling
- [ ] **Option B:** Run manually: `curl -X POST http://localhost:8000/email/poll`

### Step 3: Check Console Logs
- [ ] See JSON logs in terminal
- [ ] Look for: `"event": "email_fetched"`
- [ ] Look for: `"event": "email_classified"`
- [ ] Look for: `"event": "email_processed"`
- [ ] No ERROR level logs

### Step 4: Check Gmail
- [ ] Open Gmail: https://mail.google.com
- [ ] Go to "Drafts" folder
- [ ] **Verify:** New draft exists
- [ ] **Verify:** Subject is "Re: [original subject]"
- [ ] **Verify:** Body content is relevant and professional
- [ ] **Verify:** No typos or hallucinations

### Step 5: Check Supabase
- [ ] Go to: https://supabase.com/dashboard/project/ajdehycoypilsegmxbto
- [ ] Click "Table Editor"
- [ ] Open `email_logs` table
- [ ] **Verify:** New row exists
- [ ] **Verify:** `status` = "DRAFTED"
- [ ] **Verify:** `category` matches email type
- [ ] **Verify:** `classification_confidence` > 0.85
- [ ] **Verify:** `draft_content` contains response
- [ ] Open `agent_logs` table
- [ ] **Verify:** Multiple rows for this email (check `trace_id`)
- [ ] **Verify:** Event types: email_fetched, email_classified, email_processed

---

## Multi-Email Test

- [ ] Send 3 different test emails (use templates from `TEST_EMAILS.md`)
  - [ ] Order Status Query
  - [ ] Product Question
  - [ ] Complaint
- [ ] Wait 60 seconds or trigger poll
- [ ] **Verify:** All 3 processed
- [ ] **Verify:** All 3 have Gmail drafts
- [ ] **Verify:** All 3 logged in Supabase
- [ ] **Verify:** Classifications are accurate

---

## Classification Accuracy Test

Send these emails and verify correct category:

| Email Type | Subject | Expected Category | ✓ |
|------------|---------|------------------|---|
| Order status | "Where is my order?" | ORDER_STATUS_QUERY | [ ] |
| Product Q | "Do these work with Xbox?" | PRODUCT_QUESTION | [ ] |
| Quote | "Quote for 5 headsets" | QUOTE_REQUEST | [ ] |
| Complaint | "Wrong item received" | COMPLAINT | [ ] |
| General | "Store hours?" | GENERAL_OTHER | [ ] |
| Invoice | "Need invoice for order" | INVOICE_REQUEST | [ ] |

**Success:** 5+ out of 6 correct = ✅ Pass

---

## Order Number Extraction Test

- [ ] Send email with order number in subject: "Question about order #12345"
- [ ] Send email with order number in body: "My order number is 19919"
- [ ] **Verify:** Order numbers extracted (check `email_logs.payload.order_numbers`)

---

## Error Handling Test

### Test: Invalid Email (No Subject)
- [ ] Send email with no subject
- [ ] **Verify:** Processed without crash
- [ ] **Verify:** Subject logged as "(No Subject)"

### Test: Very Long Email
- [ ] Send email with 2000+ word body
- [ ] **Verify:** Processed successfully
- [ ] **Verify:** Classification still works

### Test: Email with Attachments
- [ ] Send email with PDF attachment
- [ ] **Verify:** `has_attachments` = true in logs
- [ ] **Verify:** Processed successfully

---

## Performance Test

- [ ] Send 5 emails quickly
- [ ] **Verify:** All processed in < 5 minutes
- [ ] **Verify:** No duplicates (each email only processed once)
- [ ] Check `agent_logs` for processing times

---

## API Endpoints Test

### GET /health
```bash
curl http://localhost:8000/health
```
- [ ] Returns 200 OK
- [ ] JSON response with `"status": "healthy"`

### GET /config
```bash
curl http://localhost:8000/config
```
- [ ] Returns 200 OK
- [ ] Shows `email_draft_mode: true`
- [ ] Shows `polling_interval: 60`

### POST /email/poll
```bash
curl -X POST http://localhost:8000/email/poll
```
- [ ] Returns processing summary
- [ ] Shows count of processed emails

---

## Draft Quality Test

Review generated drafts for:
- [ ] **Tone:** Professional and friendly
- [ ] **Accuracy:** No fabricated information
- [ ] **Relevance:** Addresses customer's question
- [ ] **Format:** Proper greeting and sign-off
- [ ] **South African English:** Correct spelling (e.g., "colour" not "color")
- [ ] **No hallucinations:** Doesn't invent order details or tracking info
- [ ] **Signature:** Ends with "Audico Online Support Team"

---

## Safety Checks

- [ ] **Draft-only mode active:** No emails auto-sent (all in drafts)
- [ ] **No PII in logs:** Check console - customer emails/phones masked
- [ ] **No secrets exposed:** API keys not in logs
- [ ] **Error containment:** One failed email doesn't stop others

---

## Stage 1 Acceptance Criteria

### Critical (Must Pass)
- [ ] Server starts without errors
- [ ] Processes at least 10 test emails successfully
- [ ] 100% draft creation (no auto-sends)
- [ ] Supabase logs populated correctly
- [ ] Classification accuracy >80%
- [ ] No data loss or corruption

### Important (Should Pass)
- [ ] Classification accuracy >90%
- [ ] Processing time < 2 minutes per email
- [ ] No crashes or hangs
- [ ] Logs are readable and useful
- [ ] Draft quality is good (human would approve)

### Nice to Have
- [ ] Order number extraction works
- [ ] Context gathering from OpenCart works
- [ ] Multiple emails processed in parallel
- [ ] Graceful error handling

---

## Sign-Off

**Tested by:** ___________________
**Date:** ___________________
**Overall Result:** ☐ PASS  ☐ FAIL  ☐ CONDITIONAL PASS

**Notes:**
_______________________________________________
_______________________________________________
_______________________________________________

---

## Next Steps After Passing

If all tests pass:
1. ✅ Stage 1 MVP is complete!
2. Review generated drafts with stakeholders
3. Collect feedback on draft quality
4. Adjust prompts if needed
5. Plan Stage 2 (Orders & Logistics)

If tests fail:
1. Check console logs for errors
2. Verify `.env` configuration
3. Check Supabase connection
4. Review error messages
5. Contact support if needed
