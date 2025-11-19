# Quick Reference Card

## Start Everything

```bash
# Backend (Terminal 1)
cd "D:\AudicoAI\Audico Management Team\audico-ai"
uvicorn src.main:app --reload --port 8000

# Dashboard (Terminal 2)
cd "D:\AudicoAI\Audico Management Team\audico-ai\dashboard"
npm run dev
```

## Access Points

- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **Dashboard**: http://localhost:3000
- **Supabase**: https://ajdehycoypilsegmxbto.supabase.co

## Common Commands

```bash
# Health check
curl http://localhost:8000/health

# Trigger email poll
curl -X POST http://localhost:8000/email/poll

# Stop polling
curl -X POST http://localhost:8000/config/agent/EmailManagementAgent/toggle?enabled=false

# Run tests
RUN_TESTS.bat

# Check logs
python check_all_logs.py
```

## File Locations

| What | Where |
|------|-------|
| Backend code | `src/` |
| Dashboard | `dashboard/` |
| Tests | `tests/` |
| Environment | `.env` |
| Docs | `*.md` files |

## Dashboard Features

1. **Email Queue** (`/emails`)
   - View pending drafts
   - Approve & send emails
   - View full details

2. **Orders Tracker** (`/orders`)
   - View all orders
   - Owner assignments
   - Financial data

3. **Agent Logs** (`/logs`)
   - System activity
   - Filter by agent/level
   - Debug information

## Key Integrations

- **Gmail**: OAuth2, polls every 60s
- **Supabase**: Postgres, all data storage
- **OpenAI**: GPT-4o-mini for classification & drafting
- **OpenCart**: Order data (Stage 2)
- **Shiplogic**: Shipments (Stage 2)

## Support Files

- **Setup**: `README.md`, `QUICK_START.txt`
- **Deployment**: `DEPLOYMENT.md`
- **Testing**: `TESTING.md`
- **Stage 1 Summary**: `STAGE1_COMPLETION_SUMMARY.md`
- **Session Handoff**: `SESSION_HANDOFF.md`

## Troubleshooting

### Backend won't start
1. Activate venv: `venv\Scripts\activate`
2. Check `.env` file exists
3. Verify port 8000 not in use

### Dashboard errors
1. Check backend is running
2. Verify `.env.local` in dashboard folder
3. Check CORS in `src/main.py`

### No emails processing
1. Check Gmail credentials in `.env`
2. Verify polling is enabled
3. Check agent logs in Supabase

## Next Steps

1. ✅ Stage 1 Complete
2. → Deploy to staging (Railway + Vercel)
3. → Test with real emails
4. → Begin Stage 2 (Orders & Logistics)

## Emergency Contacts

- **Project Docs**: Check `CLAUDE.md`
- **Technical Plan**: `TECHNICAL_DELIVERY_PLAN.md`
- **Git Issues**: Create issue on GitHub repo
