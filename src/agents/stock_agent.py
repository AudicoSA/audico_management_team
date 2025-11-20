"""
StockListingsAgent - Processes supplier price lists and manages stock/price updates.

Responsibilities:
- Parse supplier CSV/Excel price lists
- Normalize data (handle different column names, formats)
- Compare against current OpenCart inventory
- Generate pending stock_updates for approval
- Apply approved changes to OpenCart
"""
import io
import pandas as pd
from typing import Optional, Dict, List, Tuple
from datetime import datetime
import structlog

from ..connectors.supabase import SupabaseConnector
from ..connectors.opencart import OpenCartConnector

logger = structlog.get_logger()


class StockListingsAgent:
    def __init__(self, supabase: SupabaseConnector, opencart: OpenCartConnector):
        self.supabase = supabase
        self.opencart = opencart
        logger.info("stock_listings_agent_initialized", agent="StockListingsAgent")
    
    async def process_price_list(
        self,
        file_data: bytes,
        filename: str,
        supplier_name: str
    ) -> Dict:
        """
        Process a supplier price list file.
        
        Args:
            file_data: Raw file bytes (CSV or Excel)
            filename: Original filename
            supplier_name: Name of the supplier
            
        Returns:
            Dict with processing summary
        """
        logger.info("processing_price_list", 
                   filename=filename, 
                   supplier=supplier_name)
        
        try:
            # 1. Upload file to Supabase Storage
            storage_path = await self._upload_to_storage(file_data, filename, supplier_name)
            
            # 2. Create upload record
            upload_id = await self._create_upload_record(
                supplier_name, filename, storage_path
            )
            
            # 3. Parse the file
            df = await self._parse_file(file_data, filename)
            
            if df is None or df.empty:
                await self._mark_upload_failed(upload_id, "Failed to parse file or empty")
                return {"status": "failed", "error": "Failed to parse file"}
            
            # 4. Normalize column names
            df = self._normalize_columns(df)
            
            # 5. Process each row
            changes_detected = 0
            for idx, row in df.iterrows():
                sku = row.get('sku')
                if not sku:
                    continue
                
                # Store in supplier_catalogs
                await self._upsert_supplier_catalog(upload_id, supplier_name, row)
                
                # Compare with OpenCart and create stock_updates if different
                detected = await self._detect_changes(upload_id, supplier_name, row)
                changes_detected += detected
            
            # 6. Mark upload as completed
            await self._mark_upload_completed(upload_id, len(df), len(df))
            
            logger.info("price_list_processed",
                       upload_id=upload_id,
                       rows=len(df),
                       changes=changes_detected)
            
            return {
                "status": "completed",
                "upload_id": upload_id,
                "rows_processed": len(df),
                "changes_detected": changes_detected
            }
            
        except Exception as e:
            logger.error("price_list_processing_failed", error=str(e))
            return {"status": "failed", "error": str(e)}
    
    async def _upload_to_storage(self, file_data: bytes, filename: str, supplier_name: str) -> str:
        """Upload price list to Supabase Storage."""
        # Create path: price_lists/supplier_name/YYYY-MM/filename
        now = datetime.utcnow()
        path = f"price_lists/{supplier_name}/{now.year}-{now.month:02d}/{filename}"
        
        # Determine content type
        content_type = "application/vnd.ms-excel" if filename.endswith('.xlsx') else "text/csv"
        
        url = await self.supabase.upload_file(
            bucket="invoices",  # Using same bucket for now
            path=path,
            data=file_data,
            content_type=content_type
        )
        
        return path
    
    async def _create_upload_record(self, supplier_name: str, filename: str, storage_path: str) -> str:
        """Create a record in price_list_uploads table."""
        result = self.supabase.client.table("price_list_uploads").insert({
            "supplier_name": supplier_name,
            "filename": filename,
            "storage_path": storage_path,
            "status": "processing"
        }).execute()
        
        return result.data[0]["id"]
    
    async def _parse_file(self, file_data: bytes, filename: str) -> Optional[pd.DataFrame]:
        """Parse CSV or Excel file into DataFrame."""
        try:
            if filename.endswith('.csv'):
                return pd.read_csv(io.BytesIO(file_data))
            elif filename.endswith(('.xlsx', '.xls')):
                return pd.read_excel(io.BytesIO(file_data))
            else:
                logger.warning("unsupported_file_format", filename=filename)
                return None
        except Exception as e:
            logger.error("file_parse_error", filename=filename, error=str(e))
            return None
    
    def _normalize_columns(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Normalize column names to standard format.
        Handles variations like: SKU, Model, Item Code, Product Code, etc.
        """
        # Create mapping of possible column names to standard names
        column_mapping = {
            # SKU variations
            'sku': 'sku',
            'model': 'sku',
            'item code': 'sku',
            'product code': 'sku',
            'item_code': 'sku',
            
            # Price variations  
            'price': 'price',
            'cost': 'price',
            'unit price': 'price',
            'selling price': 'price',
            'cost_price': 'price',
            
            # Stock variations
            'stock': 'stock',
            'quantity': 'stock',
            'qty': 'stock',
            'available': 'stock',
            'in_stock': 'stock',
            
            # Name variations
            'name': 'name',
            'description': 'name',
            'product name': 'name',
            'item_name': 'name'
        }
        
        # Rename columns based on mapping (case-insensitive)
        new_columns = {}
        for col in df.columns:
            col_lower = col.lower().strip()
            if col_lower in column_mapping:
                new_columns[col] = column_mapping[col_lower]
        
        df = df.rename(columns=new_columns)
        return df
    
    async def _upsert_supplier_catalog(self, upload_id: str, supplier_name: str, row: pd.Series):
        """Store row in supplier_catalogs table."""
        sku = row.get('sku')
        if not sku:
            return
        
        self.supabase.client.table("supplier_catalogs").upsert({
            "upload_id": upload_id,
            "supplier_name": supplier_name,
            "sku": str(sku),
            "name": row.get('name'),
            "cost_price": float(row['price']) if pd.notna(row.get('price')) else None,
            "stock_level": int(row['stock']) if pd.notna(row.get('stock')) else None,
            "raw_data": row.to_dict()
        }, on_conflict="supplier_name,sku").execute()
    
    async def _detect_changes(self, upload_id: str, supplier_name: str, row: pd.Series) -> int:
        """
        Compare row data with OpenCart and create stock_updates for differences.
        Returns number of changes detected.
        """
        sku = row.get('sku')
        if not sku:
            return 0
        
        # Get current product from OpenCart (if exists)
        # For now, we'll create pending updates for all items
        # In a real implementation, you'd query OpenCart here
        
        changes = 0
        
        # Check price change
        new_price = row.get('price')
        if pd.notna(new_price):
            self.supabase.client.table("stock_updates").insert({
                "sku": str(sku),
                "field_name": "price",
                "old_value": None,  # Would fetch from OpenCart
                "new_value": str(new_price),
                "upload_id": upload_id,
                "supplier_name": supplier_name,
                "status": "pending"
            }).execute()
            changes += 1
        
        # Check stock change
        new_stock = row.get('stock')
        if pd.notna(new_stock):
            self.supabase.client.table("stock_updates").insert({
                "sku": str(sku),
                "field_name": "stock",
                "old_value": None,  # Would fetch from OpenCart
                "new_value": str(int(new_stock)),
                "upload_id": upload_id,
                "supplier_name": supplier_name,
                "status": "pending"
            }).execute()
            changes += 1
        
        return changes
    
    async def _mark_upload_completed(self, upload_id: str, total_rows: int, processed_rows: int):
        """Mark upload as completed."""
        self.supabase.client.table("price_list_uploads").update({
            "status": "completed",
            "total_rows": total_rows,
            "processed_rows": processed_rows
        }).eq("id", upload_id).execute()
    
    async def _mark_upload_failed(self, upload_id: str, error_message: str):
        """Mark upload as failed with error message."""
        self.supabase.client.table("price_list_uploads").update({
            "status": "failed",
            "error_message": error_message
        }).eq("id", upload_id).execute()
