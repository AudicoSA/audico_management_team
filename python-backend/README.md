# Python Backend for Audico Dashboard

This is the FastAPI backend that powers the Audico Dashboard.

## Endpoints

- `POST /chat/` - Kait AI chat interface
- `GET /health` - Health check
- `GET /api/products/...` - Product search and management
- `GET /api/orders/...` - Order management

## Environment Variables

Required:
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `OPENAI_API_KEY` - OpenAI API key
- `ANTHROPIC_API_KEY` - Anthropic API key

## Railway Deployment

Railway will automatically detect this as a Python project and use the Procfile for startup.
