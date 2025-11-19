# 🚀 Deployment Handover Document
**Date:** 2025-11-18
**Project:** Audico AI Management System
**Status:** Ready for Railway + Vercel Deployment

---

## 📋 What We Built Today

### ✅ Completed Components

1. **Next.js Dashboard** (`dashboard/`)
   - Excel-style editable orders tracker
   - Real-time Supabase integration
   - Inline editing for all fields (supplier, notes, amounts)
   - Color-coded owner columns (Wade, Lucky, Kenny, Accounts)
   - Payment status tracking
   - Show/Hide completed orders
   - **Status:** Fully functional locally at http://localhost:3001

2. **Order Import Script** (`import_opencart_db.py`)
   - Syncs orders from OpenCart MySQL → Supabase
   - Intelligent payment status detection
   - Filters out cancelled/incomplete orders (status 0, 7, 9, 10, 11, 14)
   - Imports 100 real orders successfully
   - **Status:** Working perfectly

3. **AI Email Invoice Processor** (`process_invoice_emails.py`)
   - Connects to Gmail (support@audicoonline.co.za)
   - Classifies emails as supplier invoices using GPT-4o-mini
   - Extracts order number, invoice number, and amount
   - Auto-updates orders_tracker in Supabase
   - Labels processed emails with "supplier_invoice"
   - **Status:** Tested successfully, ready for scheduling

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────┐
│   Vercel (Frontend)                 │
│   - Next.js Dashboard               │
│   - URL: dashboard.audico.vercel.app│
│   - Env: NEXT_PUBLIC_SUPABASE_*    │
└─────────────────────────────────────┘
              ↓ (reads/writes)
┌─────────────────────────────────────┐
│   Supabase (Database)               │
│   - orders_tracker (main table)     │
│   - orders_tracker_history (audit)  │
│   - email_logs (future)             │
└─────────────────────────────────────┘
              ↑ (updates)
┌─────────────────────────────────────┐
│   Railway (Backend Agents)          │
│   Cron Job 1: Email Processor       │
│   Schedule: 0 * * * * (every hour)  │
│   Command: python process_invoice_  │
│            emails.py --max 20 --all │
│                                     │
│   Cron Job 2: Order Sync (optional) │
│   Schedule: 0 */6 * * * (every 6h)  │
│   Command: python import_opencart_  │
│            db.py --days 1 --limit 50│
└─────────────────────────────────────┘
```

---

## 📦 Deployment Plan for Tomorrow

### Phase 1: Deploy Dashboard to Vercel (15 mins)

**Steps:**
```bash
# 1. Navigate to dashboard directory
cd "D:\AudicoAI\Audico Management Team\audico-ai\dashboard"

# 2. Install Vercel CLI (if needed)
npm i -g vercel

# 3. Login to Vercel
vercel login

# 4. Deploy
vercel --prod
```

**Environment Variables to Add in Vercel:**
- `NEXT_PUBLIC_SUPABASE_URL` = `https://ajdehycoypilsegmxbto.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (from `.env.local`)

**Expected Result:**
- Dashboard live at `https://audico-dashboard.vercel.app`
- Able to view and edit orders
- Connected to production Supabase

---

### Phase 2: Deploy Backend to Railway (30 mins)

#### 2.1 Prepare Railway Configuration Files

**Create `railway.json` in project root:**
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "pip install -r requirements.txt"
  },
  "deploy": {
    "startCommand": "echo 'Railway backend ready'",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

**Create `requirements.txt`:**
```txt
python-dotenv==1.0.0
supabase==2.0.3
google-api-python-client==2.108.0
google-auth-httplib2==0.1.1
google-auth-oauthlib==1.1.0
openai==1.6.1
pymysql==1.1.0
```

**Create `Procfile` (optional, for clarity):**
```
worker: python process_invoice_emails.py --max 20 --all
```

#### 2.2 Deploy to Railway

**Steps:**
1. Go to [railway.app](https://railway.app) and login
2. Click "New Project" → "Deploy from GitHub repo"
3. Connect your GitHub account
4. Select repository: `audico-ai`
5. Railway will auto-detect Python and start deploying

#### 2.3 Add Environment Variables in Railway

Navigate to **Variables** tab and add:

```bash
# OpenAI
OPENAI_API_KEY=sk-proj-...

# Gmail OAuth
GMAIL_REFRESH_TOKEN=1//03F1aGX...
# Note: Client ID/Secret read from client_secret_*.json file

# Supabase
SUPABASE_URL=https://ajdehycoypilsegmxbto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
SUPABASE_ANON_KEY=eyJhbGc...

# OpenCart (for order sync)
OPENCART_DB_HOST=your-opencart-db-host
OPENCART_DB_PORT=3306
OPENCART_DB_USER=your-db-user
OPENCART_DB_PASSWORD=your-db-password
OPENCART_DB_NAME=your-db-name
OPENCART_TABLE_PREFIX=oc_
```

#### 2.4 Set Up Cron Jobs in Railway

**Option A: Railway Cron (Built-in)**
1. In Railway project, click "New" → "Cron Job"
2. **Email Processor Cron:**
   - Name: `email-invoice-processor`
   - Schedule: `0 * * * *` (every hour)
   - Command: `python process_invoice_emails.py --max 20 --all`
   - Enable: ✅

3. **Order Sync Cron (Optional):**
   - Name: `opencart-order-sync`
   - Schedule: `0 */6 * * *` (every 6 hours)
   - Command: `python import_opencart_db.py --days 1 --limit 50`
   - Enable: ✅

**Option B: External Cron Service (Backup)**
If Railway cron doesn't work, use [cron-job.org](https://cron-job.org):
- Create HTTP endpoint wrapper
- Trigger via webhook

---

## 🔐 Security Checklist

### Files to NEVER Commit:
- ✅ `.env` (already in .gitignore)
- ✅ `.env.local` (dashboard env)
- ✅ `client_secret_*.json` (Gmail OAuth)
- ⚠️ **IMPORTANT:** Upload `client_secret_*.json` manually to Railway as a file

### Upload Client Secret to Railway:
```bash
# In Railway dashboard
# Go to: Settings → Files
# Upload: client_secret_2_261944794374-odd129phrcv8l0k4nd5l9c3qokukesj9.apps.googleusercontent.com.json
# Path: /app/client_secret_2_261944794374-odd129phrcv8l0k4nd5l9c3qokukesj9.apps.googleusercontent.com.json
```

Or add to `.railway.json`:
```json
{
  "deploy": {
    "startCommand": "python process_invoice_emails.py --max 20 --all"
  },
  "build": {
    "watchPatterns": ["client_secret_*.json"]
  }
}
```

---

## 🧪 Testing After Deployment

### Test Dashboard (Vercel)
```bash
# 1. Visit deployed URL
https://audico-dashboard.vercel.app/orders

# 2. Verify can see orders
# 3. Test inline editing (click supplier field, type name, press Enter)
# 4. Check if update persists (refresh page)
```

### Test Email Processor (Railway)
```bash
# Option 1: Manual trigger via Railway CLI
railway run python process_invoice_emails.py --max 5 --all

# Option 2: Wait for scheduled cron (check logs)
railway logs --tail

# Option 3: Send test invoice email to support@audicoonline.co.za
# Subject: "Invoice for Order #28764"
# Body: "Invoice #INV-12345, Amount: R1,234.56"
# Wait 1 hour, check if order updated in dashboard
```

---

## 📊 Monitoring & Logs

### Railway Logs
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# View logs
railway logs --tail

# View specific service
railway logs --service email-processor --tail
```

### Check Cron Execution
```bash
# In Railway dashboard → Observability → Logs
# Filter by: "invoice_processor"
# Look for: "processing_completed"
```

### Supabase Logs
```sql
-- Check recent updates to orders
SELECT order_no, supplier, invoice_no, supplier_amount, updated_at
FROM orders_tracker
WHERE updated_at > NOW() - INTERVAL '1 day'
ORDER BY updated_at DESC
LIMIT 20;

-- Check history (audit trail)
SELECT * FROM orders_tracker_history
WHERE changed_at > NOW() - INTERVAL '1 day'
ORDER BY changed_at DESC
LIMIT 50;
```

---

## 🐛 Troubleshooting Guide

### Issue: Gmail Authentication Fails
**Symptoms:** `RefreshError: invalid_grant`

**Solution:**
```bash
# Re-generate refresh token
cd "D:\AudicoAI\Audico Management Team\audico-ai"
python fetch_gmail_refresh_token.py

# Copy new refresh token to Railway env vars
```

### Issue: Supabase Permission Denied
**Symptoms:** `permission denied for table orders_tracker`

**Solution:**
```sql
-- Run in Supabase SQL Editor
ALTER TABLE orders_tracker DISABLE ROW LEVEL SECURITY;
GRANT ALL PRIVILEGES ON orders_tracker TO anon;
GRANT ALL PRIVILEGES ON orders_tracker TO authenticated;
```

### Issue: Railway Cron Not Running
**Check:**
1. Railway logs show "Cron job started"
2. Environment variables are set correctly
3. Python dependencies installed
4. Check Railway Status Page: https://status.railway.app

**Alternative:**
Set up webhook endpoint and use external cron service.

### Issue: Dashboard Shows Old Data
**Solution:**
```tsx
// Add this to dashboard/app/orders/page.tsx
useEffect(() => {
  const interval = setInterval(fetchOrders, 30000) // Refresh every 30s
  return () => clearInterval(interval)
}, [])
```

---

## 📝 Files Created Today

### Core Application Files
- ✅ `dashboard/app/orders/page.tsx` - Orders tracker UI
- ✅ `dashboard/lib/supabase.ts` - Supabase client
- ✅ `process_invoice_emails.py` - AI email processor
- ✅ `import_opencart_db.py` - OpenCart sync script

### SQL Schema Files
- ✅ `FIX_SUPABASE_UPDATE_PERMISSIONS.sql` - Enable editing
- ✅ `FIX_HISTORY_TABLE_PERMISSIONS.sql` - Audit log permissions
- ✅ `FIX_HISTORY_TRIGGER.sql` - Drop check constraint
- ✅ `check_history_table_structure.sql` - Diagnostics

### Configuration Files (To Create Tomorrow)
- ⏳ `requirements.txt` - Python dependencies
- ⏳ `railway.json` - Railway config
- ⏳ `Procfile` - Process definitions (optional)
- ⏳ `.railwayignore` - Exclude unnecessary files

---

## 💰 Cost Estimates

### Vercel
- **Hobby Plan:** FREE
- Bandwidth: 100GB/month
- Build time: 6000 minutes/month
- **Estimate:** $0/month (hobby sufficient)

### Railway
- **Developer Plan:** $5/month
- Includes: $5 usage credit
- Cron jobs: ~$0.10/month (2 jobs × hourly)
- Storage: Minimal
- **Estimate:** ~$5-10/month

### Supabase
- **Free Plan:** Currently using
- 500MB database
- 2GB bandwidth/month
- **Estimate:** $0/month (within limits)
- **Upgrade at:** 1GB database → $25/month

### OpenAI API
- **Model:** gpt-4o-mini
- **Cost:** $0.15 per 1M input tokens, $0.60 per 1M output
- **Usage:** ~20 emails/day × 2 API calls = 40 calls/day
- **Estimate:** ~$2-5/month

**Total Monthly Cost:** ~$10-20/month

---

## 🎯 Success Criteria

### After Deployment, You Should See:

1. ✅ **Dashboard Live**
   - Can access at Vercel URL
   - Orders load correctly
   - Editing works
   - No console errors

2. ✅ **Email Processor Running**
   - Railway logs show hourly execution
   - Supplier invoices detected and processed
   - orders_tracker updated automatically

3. ✅ **Data Flow Working**
   ```
   Supplier Email → Gmail → Railway Cron → AI Extraction → Supabase Update → Dashboard Shows New Data
   ```

4. ✅ **No Manual Work Required**
   - Orders sync automatically
   - Invoices processed automatically
   - Dashboard updates in real-time

---

## 🔄 Next Steps (Post-Deployment)

### Week 1: Monitor & Tune
- Watch Railway logs daily
- Check for missed invoices
- Tune AI prompts if extraction accuracy < 90%

### Week 2: Enhance
- Add email notifications for failed extractions
- Build supplier knowledge base
- Add Shiplogic shipping cost sync

### Week 3: Automate More
- Auto-calculate profit (Cost - Supplier - Shipping)
- Auto-assign orders to owners based on product type
- Auto-mark orders as "done" when shipped

### Future Features
- Customer support AI agent
- Stock listings automation
- Social media content generation
- WhatsApp/SMS order notifications

---

## 📞 Support Contacts

**If Issues Arise:**
- Railway Support: https://railway.app/help
- Vercel Support: https://vercel.com/support
- Supabase Discord: https://discord.supabase.com

**Documentation:**
- Railway Cron: https://docs.railway.app/reference/cron-jobs
- Vercel Deployment: https://vercel.com/docs/deployments/overview
- Gmail API: https://developers.google.com/gmail/api/guides

---

## ✅ Pre-Deployment Checklist

**Before Starting Tomorrow:**

- [ ] Railway account created and verified
- [ ] Vercel account created and verified
- [ ] GitHub repository exists with all code
- [ ] All environment variables documented
- [ ] `client_secret_*.json` file ready to upload
- [ ] Supabase permissions confirmed working
- [ ] Test invoice email draft prepared
- [ ] Backup of current `.env` files stored securely

**Ready to Deploy:**
- [ ] `requirements.txt` created
- [ ] `railway.json` created
- [ ] `.railwayignore` created
- [ ] All tests passing locally

---

## 🎉 Current Status Summary

**What's Working Perfectly:**
1. ✅ Dashboard with Excel-style editing
2. ✅ Real-time Supabase sync
3. ✅ OpenCart order import (100 orders loaded)
4. ✅ Payment status logic (unpaid orders correctly marked)
5. ✅ Cancelled order filtering
6. ✅ AI email classification (tested with 5 emails)
7. ✅ Gmail OAuth working
8. ✅ Invoice data extraction ready

**What's Ready for Tomorrow:**
1. 🚀 Deploy dashboard to Vercel
2. 🚀 Deploy backend to Railway
3. 🚀 Set up cron jobs
4. 🚀 Test end-to-end flow

**Estimated Time:** 1-2 hours for full deployment

---

## 🔗 Quick Links

- **Local Dashboard:** http://localhost:3001/orders
- **Supabase Dashboard:** https://supabase.com/dashboard/project/ajdehycoypilsegmxbto
- **Gmail Label:** https://mail.google.com/mail/u/0/#label/supplier_invoice
- **Railway:** https://railway.app/dashboard
- **Vercel:** https://vercel.com/dashboard

---

**Ready to deploy tomorrow! 🚀**

All systems tested and working. Just need to push to production and set up scheduling.
