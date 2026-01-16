# MCP HTTP Service

HTTP wrapper service for Audico MCP supplier feed syncs.

## Overview

This service exposes REST API endpoints that trigger MCP supplier syncs. It's designed to run on Railway and be called by the main `audico-ai` backend.

## Architecture

```
audico-ai (Railway) → HTTP POST → mcp-http-service (Railway) → npm run sync → Supabase
```

## Endpoints

### Health Check
```bash
GET /health
```

Returns service status and available suppliers.

### List Suppliers
```bash
GET /suppliers
```

Returns list of all available supplier sync endpoints.

### Sync Individual Supplier
```bash
POST /sync/{supplier}
```

Triggers sync for a specific supplier.

**Available suppliers:**
- `nology`
- `stock2shop`
- `solution-technologies`
- `esquire`
- `scoop`
- `smart-homes`
- `connoisseur`
- `proaudio`
- `planetworld`

**Example:**
```bash
curl -X POST http://localhost:3000/sync/nology
```

**Response:**
```json
{
  "success": true,
  "supplier": "Nology",
  "duration": 12.5,
  "output": "...",
  "error": null
}
```

### Sync All Suppliers
```bash
POST /sync-all
```

Triggers sync for all suppliers sequentially.

**Response:**
```json
{
  "success": true,
  "total": 9,
  "successful": 9,
  "failed": 0,
  "duration": 125.3,
  "results": [...]
}
```

## Local Development

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables (copy from parent `.env`):
```bash
cp ../.env .env
```

3. Start the server:
```bash
npm start
```

4. Test an endpoint:
```bash
curl -X POST http://localhost:3000/sync/nology
```

## Deployment

### Railway

1. Push to GitHub
2. Create new Railway project from `audico-mcp-servers` repo
3. Set root directory to `mcp-http-service`
4. Add environment variables (Supabase credentials)
5. Deploy

### Environment Variables

Required:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_KEY` - Your Supabase service role key
- `PORT` - Port to run on (Railway sets this automatically)

## How It Works

1. Receives HTTP POST request
2. Spawns `npm run sync` subprocess in the appropriate MCP server directory
3. Captures stdout/stderr
4. Returns structured JSON response with results
5. MCP server writes data to Supabase (existing behavior)

## Integration with audico-ai

The main backend (`audico-ai`) calls this service via HTTP:

```python
# In sync_all_suppliers.py
async with httpx.AsyncClient() as client:
    response = await client.post(
        f"{MCP_SERVICE_URL}/sync/nology",
        timeout=300.0
    )
```

## Monitoring

- Check `/health` endpoint for service status
- View Railway logs for detailed sync output
- Each sync logs to console with `[SupplierName]` prefix
