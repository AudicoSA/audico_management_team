web: uvicorn src.main:app --host 0.0.0.0 --port $PORT
worker: python process_invoice_emails.py --max 20 --all
