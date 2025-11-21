import asyncio
from src.connectors.gmail import get_gmail_connector

async def main():
    gmail = get_gmail_connector()
    msg_id = "19a9b6a9b07f95fe" # Order 28766
    
    print(f"--- Fetching Content for {msg_id} ---")
    email = gmail.get_message(msg_id)
    
    print(f"Subject: {email.subject}")
    print(f"Body Preview: {email.body[:500]}")
    
    if email.has_attachments:
        print("\n--- Attachments ---")
        attachments = gmail.get_attachments(msg_id)
        for att in attachments:
            print(f"Filename: {att['filename']}")
            print(f"Text Content (First 2000 chars):\n{att['text'][:2000]}")
            print("\n-------------------\n")

if __name__ == "__main__":
    asyncio.run(main())
