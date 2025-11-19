# Deployment Guide

This guide covers deploying the Audico AI system to production.

## Architecture

- **Backend**: Railway (FastAPI + Python)
- **Dashboard**: Vercel (Next.js)
- **Database**: Supabase (managed Postgres)

## Prerequisites

1. Railway account (https://railway.app)
2. Vercel account (https://vercel.com)
3. GitHub repository with code pushed
4. All environment variables ready

## Part 1: Deploy Backend to Railway

### 1. Create New Project

1. Go to https://railway.app
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose the `audico-ai` repository
5. Railway will auto-detect Python and use the configuration in `railway.json`

### 2. Configure Environment Variables

Go to your Railway project → Variables tab and add:

```bash
# LLM Providers
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Gmail OAuth
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
GMAIL_REFRESH_TOKEN=...

# OpenCart
OPENCART_BASE_URL=https://audicoonline.co.za
OPENCART_API_KEY=...
OPENCART_DB_HOST=...
OPENCART_DB_USER=...
OPENCART_DB_PASSWORD=...
OPENCART_DB_NAME=...

# Supabase
SUPABASE_URL=https://ajdehycoypilsegmxbto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_ANON_KEY=...

# Shiplogic
SHIP_LOGIC_API_KEY=...

# Application Config
ENVIRONMENT=production
LOG_LEVEL=INFO
EMAIL_DRAFT_MODE=true
AGENT_ENABLED__EmailManagementAgent=true
```

### 3. Deploy

Railway will automatically deploy when you push to GitHub. You can also trigger manual deploys from the Railway dashboard.

### 4. Get Public URL

After deployment:
1. Go to Settings → Networking
2. Click "Generate Domain"
3. Copy the public URL (e.g., `https://audico-ai-production.up.railway.app`)

## Part 2: Deploy Dashboard to Vercel

### 1. Create New Project

1. Go to https://vercel.com
2. Click "Add New" → "Project"
3. Import the `audico-ai` repository
4. Set root directory to `dashboard`
5. Framework preset: Next.js (auto-detected)

### 2. Configure Environment Variables

Add these in Vercel project settings → Environment Variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://ajdehycoypilsegmxbto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhb...  # Anon key from Supabase
NEXT_PUBLIC_API_URL=https://audico-ai-production.up.railway.app  # Railway URL
```

### 3. Deploy

Vercel will automatically deploy. You'll get a URL like:
- `https://audico-ai-dashboard.vercel.app`

### 4. Custom Domain (Optional)

1. Go to Settings → Domains
2. Add custom domain (e.g., `dashboard.audicoonline.co.za`)
3. Update DNS records as instructed

## Part 3: Configure Supabase RLS (Row Level Security)

To secure the dashboard, enable RLS on tables:

```sql
-- Enable RLS on email_logs
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read email_logs"
  ON email_logs FOR SELECT
  TO authenticated
  USING (true);

-- Enable RLS on orders_tracker
ALTER TABLE orders_tracker ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read orders_tracker"
  ON orders_tracker FOR SELECT
  TO authenticated
  USING (true);

-- Enable RLS on agent_logs
ALTER TABLE agent_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read agent_logs"
  ON agent_logs FOR SELECT
  TO authenticated
  USING (true);
```

## Part 4: Post-Deployment Verification

### Backend Health Check

```bash
curl https://audico-ai-production.up.railway.app/health
```

Expected response:
```json
{
  "status": "healthy",
  "environment": "production",
  "agents": {
    "EmailManagementAgent": true
  }
}
```

### Test Email Processing

```bash
curl -X POST https://audico-ai-production.up.railway.app/email/poll
```

### Check Dashboard

1. Open dashboard URL
2. Navigate to Email Queue
3. Verify emails are loading from Supabase
4. Test approve/send functionality

## Part 5: Monitoring & Logs

### Railway Logs

- Go to Railway project → Deployments
- Click on active deployment
- View logs in real-time

### Supabase Monitoring

- Go to Supabase dashboard → API section
- Monitor API usage and performance

### Set Up Alerts

#### Railway Alerts

1. Go to project Settings → Notifications
2. Add webhook or email for deployment failures

#### Supabase Alerts

1. Monitor database performance in dashboard
2. Set up alerts for high CPU/memory usage

## Part 6: Staging Environment

It's recommended to create a staging environment:

### Backend Staging (Railway)

1. Create new Railway project: `audico-ai-staging`
2. Connect to `develop` branch instead of `main`
3. Use same environment variables but with `ENVIRONMENT=staging`

### Dashboard Staging (Vercel)

1. Vercel automatically creates preview deployments for PRs
2. Or create a separate project for staging
3. Point to staging backend URL

### Testing Workflow

1. Push to `develop` branch
2. Staging auto-deploys
3. Test thoroughly
4. Merge to `main` for production deploy

## Part 7: Rollback Procedure

### Railway Rollback

1. Go to Deployments tab
2. Find previous stable deployment
3. Click "Redeploy"

### Vercel Rollback

1. Go to Deployments
2. Find previous deployment
3. Click "..." → "Promote to Production"

## Part 8: Database Migrations

When you need to run new migrations:

```bash
# Connect to production database
supabase db remote commit

# Or run migration manually
supabase db push --db-url "postgresql://..."
```

## Troubleshooting

### Backend Not Starting

- Check Railway logs for errors
- Verify all environment variables are set
- Ensure `requirements.txt` is up to date

### Dashboard Can't Connect

- Verify `NEXT_PUBLIC_API_URL` points to Railway URL
- Check CORS settings in FastAPI
- Verify Supabase anon key is correct

### Email Polling Not Working

- Check `AGENT_ENABLED__EmailManagementAgent=true` in Railway
- Verify Gmail OAuth credentials
- Check agent logs in Supabase

### Database Connection Issues

- Verify Supabase service role key
- Check Supabase project is not paused
- Ensure IP allowlist includes Railway IPs (usually 0.0.0.0/0)

## Security Checklist

- [ ] All secrets stored in platform secret managers (not in code)
- [ ] RLS enabled on Supabase tables
- [ ] HTTPS enforced on all endpoints
- [ ] Rate limiting configured
- [ ] Logging excludes sensitive data
- [ ] Email draft mode enabled initially
- [ ] Approval gates configured for critical actions

## Cost Estimates

- **Railway**: ~$5-20/month (depending on usage)
- **Vercel**: Free tier sufficient for dashboard
- **Supabase**: Free tier sufficient initially (~$0-25/month)

**Total estimated**: $5-45/month depending on usage

## Next Steps After Deployment

1. Monitor logs for first 24 hours
2. Test with real customer emails
3. Train staff on dashboard
4. Enable background polling after verification
5. Begin Stage 2 development (Orders & Logistics)
