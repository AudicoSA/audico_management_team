"""
StockListingsAgent - Processes supplier price lists using Gemini File API.

Uses Google Gemini's File Search tool to extract structured product data
from any format (CSV, Excel, PDF, scanned images) without manual parsing.
"""
import json
from typing import Optional, Dict, List
from datetime import datetime
import structlog
import google.generativeai as genai
from pydantic import BaseModel

from ..connectors.supabase import SupabaseConnector
from ..connectors.opencart import OpenCartConnector
from ..utils.config import get_config

logger = structlog.get_logger()


class ProductData(BaseModel):
    """Schema for extracted product data."""
    sku: str
    name: Optional[str] = None
    price: Optional[float] = None
    stock: Optional[int] = None


class PriceListData(BaseModel):
    """Schema for complete price list extraction."""
    supplier_name: Optional[str] = None
    products: List[ProductData]


class StockListingsAgent:
    def __init__(self, supabase: SupabaseConnector, opencart: OpenCartConnector):
        self.supabase = supabase
        self.opencart = opencart
        
        # Initialize Gemini
        config = get_config()
        genai.configure(api_key=config.get("GEMINI_API_KEY") or config.get("GOOGLE_API_KEY"))
        self.model = genai.GenerativeModel("gemini-2.0-flash-exp")
        
        logger.info("stock_listings_agent_initialized", 
                   agent="StockListingsAgent", 
                   model="gemini-2.0-flash-exp")
    
    async def get_pricing_rule(self, supplier_id: str) -> Optional[Dict]:
        """Get pricing rule for a supplier."""
        try:
            response = self.supabase.client.table("supplier_pricing_rules")\
                .select("*")\
                .eq("supplier_id", supplier_id)\
                .single()\
                .execute()
            
            if response.data:
                logger.info("pricing_rule_found", supplier_id=supplier_id)
                return response.data
            return None
        except Exception as e:
            logger.warning("pricing_rule_not_found", supplier_id=supplier_id, error=str(e))
            return None
    
    async def calculate_retail_price(
        self, 
        cost_price: float, 
        supplier_id: str, 
        category: Optional[str] = None
    ) -> float:
        """Calculate retail price from cost using supplier markup rules."""
        rule = await self.get_pricing_rule(supplier_id)
        
        if not rule:
            markup_pct = 30.0  # Default
            logger.warning("using_default_markup", supplier_id=supplier_id)
        else:
            pricing_type = rule.get('pricing_type', 'cost')
            
            if pricing_type == 'retail':
                return cost_price  # Use as-is
            
            markup_pct = rule.get('default_markup_pct', 30.0)
            
            # Check category-specific markup
            if category and rule.get('category_markups'):
                category_markups = rule.get('category_markups', {})
                if category in category_markups:
                    markup_pct = category_markups[category]
        
        retail_price = cost_price * (1 + (markup_pct / 100.0))
        return round(retail_price, 2)
    
    async def process_price_list(
        self,
        file_data: bytes,
        filename: str,
        supplier_name: str
    ) -> Dict:
        """
        Process a supplier price list using Gemini File API.
        
        Args:
            file_data: Raw file bytes (CSV/Excel/PDF/any format)
            filename: Original filename
            supplier_name: Name of the supplier
            
        Returns:
            Dict with processing summary
        """
        logger.info("processing_price_list_with_gemini", 
                   filename=filename, 
                   supplier=supplier_name)
        
        try:
            # 1. Upload file to Supabase Storage (for archival)
            storage_path = await self._upload_to_storage(file_data, filename, supplier_name)
            
            # 2. Create upload record
            upload_id = await self._create_upload_record(
                supplier_name, filename, storage_path
            )
            
            # 3. Upload to Gemini File API
            gemini_file = await self._upload_to_gemini(file_data, filename)
            
            # 4. Extract structured data using Gemini
            price_list_data = await self._extract_with_gemini(gemini_file, supplier_name)
            
            if not price_list_data or not price_list_data.products:
                await self._mark_upload_failed(upload_id, "No products extracted from file")
                return {"status": "failed", "error": "No products extracted"}
            
            # 5. Process each product
            changes_detected = 0
            for product in price_list_data.products:
                # Store in supplier_catalogs
                await self._upsert_supplier_catalog(upload_id, supplier_name, product)
                
                # Detect changes vs OpenCart
                detected = await self._detect_changes(upload_id, supplier_name, product)
                changes_detected += detected
            
            # 6. Mark upload as completed
            await self._mark_upload_completed(upload_id, len(price_list_data.products), len(price_list_data.products))
            
            logger.info("price_list_processed_with_gemini",
                       upload_id=upload_id,
                       products=len(price_list_data.products),
                       changes=changes_detected)
            
            return {
                "status": "completed",
                "upload_id": upload_id,
                "rows_processed": len(price_list_data.products),
                "changes_detected": changes_detected
            }
            
        except Exception as e:
            logger.error("gemini_price_list_processing_failed", error=str(e))
            return {"status": "failed", "error": str(e)}
    
    async def _upload_to_storage(self, file_data: bytes, filename: str, supplier_name: str) -> str:
        """Upload price list to Supabase Storage for archival."""
        now = datetime.utcnow()
        path = f"price_lists/{supplier_name}/{now.year}-{now.month:02d}/{filename}"
        
        content_type = "application/octet-stream"
        if filename.endswith('.csv'):
            content_type = "text/csv"
        elif filename.endswith('.xlsx'):
            content_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        elif filename.endswith('.pdf'):
            content_type = "application/pdf"
        
        await self.supabase.upload_file(
            bucket="invoices",  # Using invoices bucket for now
            path=path,
            data=file_data,
            content_type=content_type
        )
        
        return path
    
    async def _upload_to_gemini(self, file_data: bytes, filename: str):
        """Upload file to Gemini File API."""
        import tempfile
        import os
        
        # Gemini API requires a file path, so write to temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(filename)[1]) as tmp:
            tmp.write(file_data)
            tmp_path = tmp.name
        
        try:
            # Upload to Gemini
            gemini_file = genai.upload_file(tmp_path, display_name=filename)
            logger.info("file_uploaded_to_gemini", 
                       filename=filename,
                       gemini_file_name=gemini_file.name)
            return gemini_file
        finally:
            # Clean up temp file
            os.unlink(tmp_path)
    
    async def _extract_with_gemini(self, gemini_file, supplier_name: str) -> Optional[PriceListData]:
        """
        Extract structured product data from uploaded file using Gemini.
        Uses JSON schema to enforce structured output.
        """
        prompt = f"""
You are analyzing a supplier price list from "{supplier_name}".

Extract ALL products from this file with the following information for each:
- SKU (required): Product code, model number, or item code
- Name: Product name or description (if available)
- Price: Cost per unit (extract number only, no currency symbols)
- Stock: Available quantity (extract number only)

Return the data as a JSON object matching this schema:
{{
    "supplier_name": "{supplier_name}",
    "products": [
        {{
            "sku": "ABC123",
            "name": "Product Name",
            "price": 99.99,
            "stock": 10
        }}
    ]
}}

If a field is not available in the file, omit it or set to null.
Extract ALL products - do not skip any rows.
"""
        
        try:
            # Generate content with the file
            response = self.model.generate_content(
                [gemini_file, prompt],
                generation_config=genai.GenerationConfig(
                    response_mime_type="application/json",
                    response_schema=PriceListData
                )
            )
            
            # Parse response
            result_json = json.loads(response.text)
            price_list_data = PriceListData(**result_json)
            
            logger.info("gemini_extraction_complete",
                       products_extracted=len(price_list_data.products))
            
            return price_list_data
            
        except Exception as e:
            logger.error("gemini_extraction_failed", error=str(e))
            return None
    
    async def _create_upload_record(self, supplier_name: str, filename: str, storage_path: str) -> str:
        """Create a record in price_list_uploads table."""
        result = self.supabase.client.table("price_list_uploads").insert({
            "supplier_name": supplier_name,
            "filename": filename,
            "storage_path": storage_path,
            "status": "processing"
        }).execute()
        
        return result.data[0]["id"]
    
    async def _upsert_supplier_catalog(self, upload_id: str, supplier_name: str, product: ProductData):
        """Store product in supplier_catalogs table."""
        self.supabase.client.table("supplier_catalogs").upsert({
            "upload_id": upload_id,
            "supplier_name": supplier_name,
            "sku": product.sku,
            "name": product.name,
            "cost_price": product.price,
            "stock_level": product.stock,
            "raw_data": product.dict()
        }, on_conflict="supplier_name,sku").execute()
    
    async def _detect_changes(self, upload_id: str, supplier_name: str, product: ProductData) -> int:
        """
        Compare product data with OpenCart and create price_change_queue for differences.
        Applies pricing rules before comparison.
        """
        changes = 0
        
        try:
            # Get OpenCart product
            oc_product = await self.opencart.get_product_by_sku(product.sku)
            if not oc_product:
                logger.debug("product_not_in_opencart", sku=product.sku)
                return 0
            
            # Get supplier ID from supplier_name
            supplier_response = self.supabase.client.table("suppliers")\
                .select("id")\
                .eq("name", supplier_name)\
                .single()\
                .execute()
            
            supplier_id = supplier_response.data['id'] if supplier_response.data else None
            
            # Check price change with pricing rules
            if product.price is not None and supplier_id:
                # Calculate retail price using pricing rules
                retail_price = await self.calculate_retail_price(
                    product.price, 
                    supplier_id,
                    product.name  # Use name as category for now
                )
                
                current_price = float(oc_product.get('price', 0))
                
                # Calculate change percentage
                if current_price > 0:
                    price_change_pct = ((retail_price - current_price) / current_price) * 100
                else:
                    price_change_pct = 100.0
                
                # Queue if change > 10%
                if abs(price_change_pct) > 10.0:
                    self.supabase.client.table("price_change_queue").insert({
                        "product_id": oc_product['product_id'],
                        "sku": product.sku,
                        "product_name": product.name,
                        "current_price": current_price,
                        "new_price": retail_price,
                        "price_change_pct": round(price_change_pct, 2),
                        "supplier_id": supplier_id,
                        "supplier_name": supplier_name,
                        "status": "pending"
                    }).execute()
                    changes += 1
            
            # Check stock change
            if product.stock is not None:
                current_stock = int(oc_product.get('quantity', 0))
                if product.stock != current_stock:
                    # Log stock change
                    self.supabase.client.table("stock_sync_log").insert({
                        "product_id": oc_product['product_id'],
                        "sku": product.sku,
                        "field_name": "quantity",
                        "old_value": current_stock,
                        "new_value": product.stock,
                        "changed_by": "stock_agent",
                        "change_source": "agent"
                    }).execute()
                    changes += 1
        
        except Exception as e:
            logger.error("detect_changes_failed", sku=product.sku, error=str(e))
        
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
