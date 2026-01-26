import pandas as pd
import asyncio
from src.connectors.supabase import get_supabase_connector

async def import_suppliers():
    sb = get_supabase_connector()
    
    # Read Excel
    df = pd.read_excel(r'D:\AudicoAI\Audico Management Team\Suppliers.xlsx')
    
    # Columns based on inspection:
    # 0: Unnamed: 0 (Name)
    # 1: Orders (Contact Name)
    # 2: Orders.1 (Contact Email - Stock) -- Pandas renames duplicates
    
    print(f"Loaded {len(df)} rows.")
    
    count = 0
    for index, row in df.iterrows():
        name = str(row.iloc[0]).strip()
        contact_name = str(row.iloc[1]).strip()
        contact_email = str(row.iloc[2]).strip()
        
        if name == "nan" or not name:
            continue
            
        # Clean email (remove 'nan' or empty)
        if contact_email == "nan": contact_email = None

        payload = {
            "name": name, 
            "company": name,
            "contact_name": contact_name if contact_name != "nan" else "Sales Code",
            "contact_email": contact_email,
            "street_address": "Unknown",
            "local_area": "Unknown",
            "city": "Unknown",
            "code": "0000",
            "country_code": "ZA"
        }
        
        # Upsert based on name (if constraint exists) or just insert and ignore dups?
        # Supabase 'upsert' works if there's a unique constraint on 'name'.
        # Let's try upsert.
        
        try:
            # We assume 'name' is unique or PK. Actually ID is PK.
            # We first check if it exists to get ID, or we just insert.
            # upsert requires primary key match usually?
            # Let's try to find match first.
            
            existing = sb.client.table("supplier_addresses").select("id").eq("name", name).execute()
            
            if existing.data:
                # Update
                sid = existing.data[0]["id"]
                sb.client.table("supplier_addresses").update(payload).eq("id", sid).execute()
                print(f"Updated {name}")
            else:
                # Insert
                sb.client.table("supplier_addresses").insert(payload).execute()
                print(f"Inserted {name}")
                
            count += 1
        except Exception as e:
            print(f"Error on {name}: {e}")

    print(f"Done. Processed {count} suppliers.")

if __name__ == "__main__":
    asyncio.run(import_suppliers())
