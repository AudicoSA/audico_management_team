# Quick Command Reference

## Start the Server

### Windows
Double-click: `START_SERVER.bat`

Or manually:
```bash
venv\Scripts\activate
python -m src.main
```

### Mac/Linux
```bash
source venv/bin/activate
python -m src.main
```

---

## Test the API

### Health Check
```bash
curl http://localhost:8000/health
```

Or open in browser: http://localhost:8000/health

### Check Configuration
```bash
curl http://localhost:8000/config
```

### Manually Trigger Email Poll
```bash
curl -X POST http://localhost:8000/email/poll
```

### Process Specific Email
```bash
curl -X POST http://localhost:8000/email/process/MESSAGE_ID_HERE
```

---

## Installation Commands

### Create Virtual Environment
```bash
python -m venv venv
```

### Activate Virtual Environment
Windows:
```bash
venv\Scripts\activate
```

Mac/Linux:
```bash
source venv/bin/activate
```

### Install Dependencies
```bash
python -m pip install --upgrade pip
pip install -r requirements.txt
```

### Optional: Install Dev Tools
```bash
pip install -r requirements-dev.txt
```

---

## Verify Installation

### Test Config Loading
```bash
python -c "from src.utils.config import get_config; print('Config loaded!'); print('Supabase:', get_config().supabase_url)"
```

### Test Imports
```bash
python -c "from src.agents.email_agent import get_email_agent; print('Email agent imported successfully!')"
```

---

## Check Logs

### View Supabase Tables
1. Go to: https://supabase.com/dashboard/project/ajdehycoypilsegmxbto
2. Click "Table Editor"
3. View tables:
   - `email_logs` - Email processing records
   - `agent_logs` - Agent event logs
   - `orders_tracker` - Order management

### Check Console Logs
Watch the terminal where server is running for JSON logs

---

## Troubleshooting

### Gmail OAuth Issues
Re-generate refresh token:
```bash
cd "D:\AudicoAI\Audico Management Team"
python fetch_gmail_refresh_token.py
```

### View .env file location
```bash
python -c "from pathlib import Path; from src.utils.config import find_env_file; print('Using .env:', find_env_file())"
```

### Test Supabase Connection
```bash
python -c "from src.connectors.supabase import get_supabase_connector; conn = get_supabase_connector(); print('Supabase connected!')"
```

---

## Stop the Server

Press `Ctrl+C` in the terminal where server is running
