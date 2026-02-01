import csv
import sys
import os
from pathlib import Path
from typing import Dict, Any, List

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "src"))

from connectors.supabase import SupabaseConnector
from utils.logging import setup_logging

# Setup logging
setup_logging()

def normalize_country_code(country: str) -> str:
    if not country:
        return "ZA"
    country = country.strip().upper()
    if country in ["SOUTH AFRICA", "ZA", "ZAF"]:
        return "ZA"
    return country

def import_suppliers():
    """Import suppliers from Address_Book.csv"""
    
    csv_path = Path(__file__).parent.parent.parent.parent / "Address_Book.csv"
    
    if not csv_path.exists():
        print(f"Error: Could not find {csv_path}")
        return

    connector = SupabaseConnector()
    
    print(f"Reading from {csv_path}...")
    
    imported_count = 0
    skipped_count = 0
    
    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f, delimiter=';')
        
        for row in reader:
            # Only import Business addresses
            address_type = row.get('Address type', '').strip().lower()
            if 'business' not in address_type:
                continue
                
            company_name = row.get('Company/Building / Floor / Unit', '').strip()
            if not company_name:
                continue
                
            # Prepare record
            record = {
                "name": company_name,
                "company": company_name,
                "street_address": row.get('Street address', '').strip(),
                "local_area": row.get('Suburb', '').strip(),
                "city": row.get('City', '').strip(),
                "code": row.get('Postal code', '').strip(),
                "country_code": normalize_country_code(row.get('Country', '')),
                "contact_name": row.get('Contact name', '').strip(),
                "contact_email": row.get('Contact email', '').strip(),
                "contact_phone": row.get('Mobile number', '').strip()
            }
            
            # Basic validation
            if not record['street_address'] or not record['city']:
                print(f"Skipping {company_name}: Missing address details")
                skipped_count += 1
                continue

            try:
                # Upsert into Supabase
                # We use 'name' as the unique key constraint if possible, but Supabase upsert needs primary key or unique constraint.
                # The migration defined 'name' as UNIQUE.
                
                connector.client.table("suppliers").upsert(
                    record, 
                    on_conflict="name"
                ).execute()
                
                print(f"Imported: {company_name}")
                imported_count += 1
                
            except Exception as e:
                print(f"Failed to import {company_name}: {e}")
                skipped_count += 1

    print(f"\nImport completed!")
    print(f"Imported: {imported_count}")
    print(f"Skipped: {skipped_count}")

if __name__ == "__main__":
    import_suppliers()
