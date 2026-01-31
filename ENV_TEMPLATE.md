# Environment Variables Template

Copy this to `.env.local` and fill in your values.

```bash
# =============================================================================
# SUPABASE (Database + Auth)
# =============================================================================
# Get these from: https://supabase.com/dashboard/project/YOUR_PROJECT/settings/api
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_KEY=your_service_role_key_here

# =============================================================================
# AI PROVIDERS
# =============================================================================
# Anthropic Claude - https://console.anthropic.com/
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx

# OpenAI (for embeddings) - https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-proj-xxxxx
NEXT_PUBLIC_OPENAI_API_KEY=sk-proj-xxxxx  # Same as above, exposed to client for embeddings

# =============================================================================
# OPENCART INTEGRATION (Optional - for stock sync)
# =============================================================================
OPENCART_ADMIN_USERNAME=admin
OPENCART_ADMIN_PASSWORD=your_password
OPENCART_SECRET_KEY=base64_encoded_secret
OPENCART_CLIENT_ID=your_client_id
OPENCART_CLIENT_SECRET=your_client_secret

# OpenCart REST API Base
OC_BASE=https://www.your-opencart-site.com
OC_CLIENT_ID=your_client_id
OC_CLIENT_SECRET=your_client_secret

# =============================================================================
# ADMIN PORTAL
# =============================================================================
ADMIN_PASSWORD=your_admin_password

# =============================================================================
# DEBUGGING
# =============================================================================
LOG_FILTER_DIAGNOSTICS=true  # Set to false in production
```

## Critical Notes

1. **Supabase Service Key**: Never expose this to the client. Use `SUPABASE_SERVICE_KEY` only in server-side code.

2. **OpenAI Key**: The `text-embedding-3-small` model is used for vector embeddings. Cost is ~$0.02/million tokens.

3. **Anthropic Key**: Optional if using OpenAI for chat. Currently the system uses OpenAI GPT-4 for chat, Claude for advanced reasoning.
