web: /opt/venv/bin/python -m uvicorn src.main:app --host 0.0.0.0 --port $PORT
worker: . /opt/venv/bin/activate && python process_invoice_emails.py --max 20 --all
