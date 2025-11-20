"""
Script to import orders from Excel file.
Run with: py -m src.scripts.import_excel
"""
import asyncio
import pandas as pd
from pathlib import Path
from src.connectors.supabase import get_supabase_connector
from src.utils.logging import AgentLogger

logger = AgentLogger("ImportExcel")

EXCEL_PATH = r"D:\AudicoAI\Audico Management Team\AUDICO 17_Nov_2025.xlsx"

async def import_excel():
    """Parse Excel and upsert to Supabase."""
    supabase = get_supabase_connector()
    
    print(f"Reading Excel: {EXCEL_PATH}")
    
    # 1. Find the header row
    # Read first 20 rows to find "Order"
    df_preview = pd.read_excel(EXCEL_PATH, header=None, nrows=20)
    
    header_row_idx = None
    for idx, row in df_preview.iterrows():
        row_str = " ".join([str(x) for x in row.values if pd.notna(x)]).lower()
        if "order" in row_str and "customer" in row_str:
            header_row_idx = idx
            break
            
    if header_row_idx is None:
        print("Could not find header row with 'Order' and 'Customer'. using default read.")
        # Fallback: try reading with default header
        df = pd.read_excel(EXCEL_PATH)
    else:
        print(f"Found header at row {header_row_idx}")
        df = pd.read_excel(EXCEL_PATH, header=header_row_idx)
        
    # 2. Normalize columns
    # We need: Order No, Customer, Status, Total, Date Added
    # Map likely column names
    col_map = {}
    for col in df.columns:
        c = str(col).lower().strip()
        if "order" in c and ("id" in c or "no" in c):
            col_map["order_no"] = col
        elif "customer" in c:
            col_map["customer"] = col
        elif "status" in c:
            col_map["status"] = col
        elif "total" in c:
            col_map["total"] = col
        elif "date" in c:
            col_map["date"] = col
        elif "supplier" in c:
            col_map["supplier"] = col
            
    print(f"Mapped columns: {col_map}")
    
    if "order_no" not in col_map:
        print("Error: Could not identify Order Number column.")
        return

    # 3. Process rows
    count = 0
    for _, row in df.iterrows():
        try:
            order_no = str(row[col_map["order_no"]])
            if pd.isna(order_no) or order_no.lower() == "nan":
                continue
                
            # Clean order number (remove #, etc)
            order_no = order_no.replace("#", "").strip()
            if not order_no.isdigit():
                continue
                
            customer = str(row.get(col_map.get("customer"), "Unknown"))
            status = str(row.get(col_map.get("status"), "Pending"))
            supplier = str(row.get(col_map.get("supplier"), "")) if "supplier" in col_map else None
            
            if pd.isna(supplier) or supplier.lower() == "nan":
                supplier = None
                
            # Upsert
            await supabase.upsert_order_tracker(
                order_no=order_no,
                order_name=customer,
                supplier=supplier,
                notes=f"Imported from Excel. Status: {status}",
                source="excel_import",
                flag_urgent=False
            )
            count += 1
            if count % 10 == 0:
                print(f"Imported {count} orders...")
                
        except Exception as e:
            print(f"Skipping row: {e}")
            
    print(f"\nSuccessfully imported {count} orders.")

if __name__ == "__main__":
    asyncio.run(import_excel())
