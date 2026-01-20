"""
StockListingsAgent - Processes supplier price lists using Gemini File API.

Uses Google Gemini's File Search tool to extract structured product data
from any format (CSV, Excel, PDF, scanned images) without manual parsing.
"""
import json
from typing import Optional, Dict, List, Any
from datetime import datetime
import structlog
from openai import OpenAI
import io
import pandas as pd
import re
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
        
        # Initialize OpenAI
        config = get_config()
        self.client = OpenAI(api_key=config.openai_api_key)
        self.model = "gpt-4o"
        
        logger.info("stock_listings_agent_initialized", 
                   agent="StockListingsAgent", 
                   model=self.model)
    
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
            logger.warning("pricing_rule_not_found", supplier_id=supplier_id, error=str(e))
            return None
        except Exception as e:
            logger.warning("pricing_rule_not_found", supplier_id=supplier_id, error=str(e))
            return None

    async def _extract_text_from_file(self, file_data: bytes, filename: str) -> Optional[str]:
        """Extract text from PDF, Excel, or CSV."""
        try:
            file_ext = filename.split('.')[-1].lower()
            
            if file_ext == 'pdf':
                # Parse PDF
                import pypdf
                pdf_file = io.BytesIO(file_data)
                reader = pypdf.PdfReader(pdf_file)
                text = ""
                for page in reader.pages:
                    text += page.extract_text() + "\n"
                return text
                
            elif file_ext in ['xlsx', 'xls']:
                # Parse Excel (All Sheets)
                excel_file = io.BytesIO(file_data)
                xls = pd.ExcelFile(excel_file)
                text = ""
                for sheet_name in xls.sheet_names:
                    df = pd.read_excel(xls, sheet_name=sheet_name)
                    text += f"\n--- Sheet: {sheet_name} ---\n"
                    text += df.to_csv(index=False)
                return text
                
            elif file_ext == 'csv':
                # Parse CSV
                csv_file = io.BytesIO(file_data)
                df = pd.read_csv(csv_file)
                return df.to_csv(index=False)
                
            return None
            
        except Exception as e:
            logger.error("file_extraction_failed", error=str(e))
            return None

    async def _extract_with_openai(self, text_content: str, supplier_name: str) -> Optional[PriceListData]:
        """
        Extract structured product data from text using OpenAI GPT-4o.
        """
        try:
            # Truncate text if too long (approx 100k chars)
            if len(text_content) > 100000:
                text_content = text_content[:100000] + "...(truncated)"
                
            prompt = f"""
            You are a data extraction assistant. Extract product information from the following supplier price list text.
            Supplier: {supplier_name}
            
            Rules:
            1. Extract SKU, Name, Price, and Stock Level.
            2. If 'Stock' column is missing, assume 0 or look for 'In Stock'/'Yes' indicators (convert to 100).
            3. Ignore headers, footers, and page numbers.
            4. Return JSON only, matching this schema:
            {{
                "supplier_name": "{supplier_name}",
                "products": [
                    {{
                        "sku": "string",
                        "name": "string",
                        "price": number,
                        "stock": integer
                    }}
                ]
            }}
            
            Special Rules for Nology:
            - Use the 'Cost' column if available, otherwise 'Price'.
            - Ignore 'MSRP' or 'RRP'.
            
            Text Content:
            {text_content}
            """
            
            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "You are a helpful assistant that extracts structured data from text."},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"}
            )
            
            content = response.choices[0].message.content
            result_json = json.loads(content)
            price_list_data = PriceListData(**result_json)
            
            logger.info("openai_extraction_complete", 
                       products_extracted=len(price_list_data.products))
            
            return price_list_data
            
        except Exception as e:
            logger.error("openai_extraction_failed", error=str(e))
            return None

    def _normalize_string(self, s: str) -> str:
        """Remove non-alphanumeric characters and lowercase."""
        if not s:
            return ""
        return re.sub(r'[^a-z0-9]', '', str(s).lower())

    async def process_price_list(
        self,
        file_data: bytes,
        filename: str,
        supplier_name: str,
        instruction: str = 'cost_excl_vat',
        upload_id: Optional[str] = None,
        markup_pct: Optional[float] = None
    ) -> Dict:
        """
        Process a supplier price list using OpenAI GPT-4o.
        """
        logger.info("processing_price_list_with_openai", 
                   filename=filename, 
                   supplier=supplier_name,
                   instruction=instruction,
                   markup_pct=markup_pct,
                   existing_upload_id=upload_id)
        
        try:
            # 1. Upload file to Supabase Storage (for archival)
            storage_path = await self._upload_to_storage(file_data, filename, supplier_name)
            
            # 2. Create or Update upload record
            if not upload_id:
                upload_id = await self._create_upload_record(
                    supplier_name, filename, storage_path
                )
            else:
                self.supabase.client.table("price_list_uploads").update({
                    "storage_path": storage_path,
                    "status": "processing"
                }).eq("id", upload_id).execute()
            
            # 3. Extract text/data from file locally
            text_content = await self._extract_text_from_file(file_data, filename)
            
            if not text_content:
                 return {"status": "failed", "error": "Could not extract text from file"}

            # 4. Extract structured data using OpenAI
            price_list_data = await self._extract_with_openai(text_content, supplier_name)
            
            if not price_list_data or not price_list_data.products:
                return {"status": "failed", "error": "No products extracted"}
            
            # 5. Process each product
            extracted_skus = set()
            changes_detected = 0
            
            for product in price_list_data.products:
                extracted_skus.add(product.sku)
                
                # Store in supplier_catalogs
                await self._upsert_supplier_catalog(upload_id, supplier_name, product)
                
                # Detect changes vs OpenCart (Price only)
                detected = await self._detect_changes(upload_id, supplier_name, product, instruction, markup_pct)
                changes_detected += detected
            
            # 6. Process Discontinued Products (Missing from file)
            discontinued_count = await self._process_discontinued_products(supplier_name, extracted_skus, price_list_data.products)
            changes_detected += discontinued_count
            
            # 7. Mark upload as completed
            await self._mark_upload_completed(upload_id, len(price_list_data.products), len(price_list_data.products))
            
            logger.info("price_list_processed_with_openai",
                       upload_id=upload_id,
                       products=len(price_list_data.products),
                       changes=changes_detected,
                       discontinued=discontinued_count)
            
            return {
                "status": "completed",
                "upload_id": upload_id,
                "rows_processed": len(price_list_data.products),
                "changes_detected": changes_detected,
                "discontinued": discontinued_count
            }
            
        except Exception as e:
            logger.error("openai_price_list_processing_failed", error=str(e))
            return {"status": "failed", "error": str(e)}
    
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
    


    async def poll_pending_uploads(self):
        """Poll and process pending price list uploads."""
        try:
            # 1. Fetch pending uploads
            response = self.supabase.client.table("price_list_uploads")\
                .select("*")\
                .eq("status", "pending")\
                .execute()
            
            if not response.data:
                return

            logger.info("pending_uploads_found", count=len(response.data))

            for upload in response.data:
                await self._process_single_upload(upload)
                
        except Exception as e:
            logger.error("poll_pending_uploads_failed", error=str(e))

    async def _process_single_upload(self, upload: Dict):
        """Process a single upload record."""
        upload_id = upload['id']
        filename = upload['filename']
        supplier_name = upload['supplier_name']
        storage_path = upload['storage_path']
        instruction = upload.get('instruction', 'retail')
        markup = upload.get('markup_pct')
        
        logger.info("processing_upload", upload_id=upload_id, filename=filename)
        
        try:
            # 1. Mark as processing
            self.supabase.client.table("price_list_uploads").update({
                "status": "processing",
                "started_at": datetime.utcnow().isoformat()
            }).eq("id", upload_id).execute()
            
            # 2. Download file
            # Bucket is 'invoices' based on frontend code
            bucket = "invoices" 
            file_data = self.supabase.client.storage.from_(bucket).download(storage_path)
            
            # 3. Process
            # process_price_list handles completion status updates
            await self.process_price_list(
                file_data=file_data,
                filename=filename,
                supplier_name=supplier_name,
                instruction=instruction,
                upload_id=upload_id,
                markup_pct=markup
            )
            
        except Exception as e:
            logger.error("upload_processing_failed", upload_id=upload_id, error=str(e))
            self.supabase.client.table("price_list_uploads").update({
                "status": "failed",
                "error_message": str(e)
            }).eq("id", upload_id).execute()

    async def process_approval_queue(self):
        """Process all products in approved_pending status."""
        try:
            # Fetch pending
            response = self.supabase.client.table("new_products_queue")\
                .select("id")\
                .eq("status", "approved_pending")\
                .execute()
            
            if not response.data:
                return
            
            logger.info("processing_approval_queue", count=len(response.data))
            
            for item in response.data:
                await self.approve_new_product(item['id'])
                
        except Exception as e:
            logger.error("queue_processing_failed", error=str(e))

    async def approve_new_product(self, queue_id: str) -> Dict:
        """
        Approve a product from the queue and create it in OpenCart.
        """
        try:
            # 1. Get product from queue
            response = self.supabase.client.table("new_products_queue")\
                .select("*")\
                .eq("id", queue_id)\
                .single()\
                .execute()
            
            if not response.data:
                return {"status": "failed", "error": "Product not found in queue"}
            
            product = response.data
            
            # 2. Get manufacturer (brand) name
            # Fix: Do NOT use supplier_name (e.g. Esquire) as Manufacturer.
            # Instead, try to infer brand from the Product Name (e.g. "Dahua ...")
            manufacturer = None
            first_word = product['name'].split(' ')[0] if product.get('name') else ""
            if first_word and len(first_word) > 2:
                 manufacturer = await self.opencart.get_manufacturer_by_name(first_word)
            
            # 3. Create product in OpenCart
            
            # Check if product already exists to prevent duplicates (Idempotency)
            # Use robust lookup (SKU, Model, Normalized Model)
            existing_product = await self._find_existing_product(product['sku'])
            if existing_product:
                logger.info("product_already_exists_skipping_creation", sku=product['sku'])
                product_id = existing_product['product_id']
            else:
                # Simplify Name Logic: Use valid name directly from queue
                product_name = product['name']

                # --- VALIDATION GUARD ---
                # Reduce risk of creating corrupted products (e.g. "Electronics Mega Store" or "name")
                if not product_name or product_name.lower().strip() in ['name', 'product name'] or 'mega store' in product_name.lower():
                    logger.error("invalid_product_name_rejected", queue_id=queue_id, name=product_name)
                    return {"status": "failed", "error": f"Invalid product name rejected: {product_name}"}
                
                if product['sku'].lower() == 'name':
                     logger.error("invalid_sku_rejected", queue_id=queue_id, sku=product['sku'])
                     return {"status": "failed", "error": "Invalid SKU rejected: 'name'"}
                # ------------------------

                # Calculate retail price
                # Improved Logic: Check if 'selling_price' is provided in queue (e.g. from Scoop/Alignment)
                # If so, use it as the Retail Price.
                # If not, fallback to treating 'cost_price' as Retail (legacy behavior, or for manual uploads where user input Retail)
                
                queue_selling_price = float(product.get('selling_price') or 0)
                queue_cost_price = float(product.get('cost_price') or 0)
                
                if queue_selling_price > 0:
                     retail_price = queue_selling_price
                     # If we have a cost price, use it. Otherwise reverse calc.
                     cost_price = queue_cost_price if queue_cost_price > 0 else (retail_price / 1.5)
                else:
                    # Fallback: Treat cost_price as Retail (as per original logic/assumption for some flows)
                    retail_price = queue_cost_price
                    cost_price = retail_price / 1.5
                
                product_data = {
                    "sku": product['sku'],
                    "name": product_name,
                    "price": retail_price,
                    "cost": cost_price,
                    "quantity": product['stock_level'],
                    "manufacturer_id": manufacturer['manufacturer_id'] if manufacturer else 0,
                    "status": 1  # Enabled
                }
                
                product_id = await self.opencart.create_product(product_data)
            
            if not product_id:
                return {"status": "failed", "error": "Failed to create product in OpenCart"}
            
            # 4. Update queue status
            self.supabase.client.table("new_products_queue").update({
                "status": "approved"
            }).eq("id", queue_id).execute()
            
            # 5. [FIX] Ensure the Link is saved in product_matches
            # We must find the internal product ID by SKU to link it.
            try:
                # Find internal product
                internal_prod_res = self.supabase.client.table("products")\
                    .select("id")\
                    .eq("sku", product['sku'])\
                    .limit(1)\
                    .execute()
                
                if internal_prod_res.data:
                    internal_id = internal_prod_res.data[0]['id']
                    
                    # Update (or Upsert) the match record
                    # We look for an existing match for this internal ID
                    self.supabase.client.table("product_matches").update({
                        "opencart_product_id": product_id,
                        "match_type": "created_via_queue"
                    }).eq("internal_product_id", internal_id).execute()
                    
                    logger.info("product_link_established", internal_id=internal_id, opencart_id=product_id)
                else:
                    logger.warning("internal_product_not_found_for_link", sku=product['sku'])
            
            except Exception as link_error:
                 # Log but don't fail the whole approval if linking fails (it can be fixed by daily sync later if we improve it)
                 logger.error("failed_to_create_link", sku=product['sku'], error=str(link_error))

            logger.info("product_approved_and_created", 
                       queue_id=queue_id, 
                       product_id=product_id,
                       sku=product['sku'])
            
            return {"status": "success", "product_id": product_id}
            
        except Exception as e:
            logger.error("approve_product_failed", queue_id=queue_id, error=str(e))
            return {"status": "failed", "error": str(e)}

    async def _queue_new_product(self, supplier_name: str, product: ProductData):
        """Add new product to the review queue."""
        try:
            self.supabase.client.table("new_products_queue").insert({
                "supplier_name": supplier_name,
                "sku": product.sku,
                "name": product.name,
                "cost_price": product.price,
                "stock_level": product.stock,
                "status": "pending"
            }).execute()
        except Exception as e:
            logger.error("queue_new_product_failed", sku=product.sku, error=str(e))

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
    
    async def _find_existing_product(self, sku: str) -> Optional[Dict]:
        """
        Find product by SKU or Model, handling common formatting differences.
        """
        # 1. Exact SKU match
        product = await self.opencart.get_product_by_sku(sku)
        if product:
            return product
            
        # 2. Exact Model match
        product = await self.opencart.get_product_by_model(sku)
        if product:
            return product
            
        # 3. Normalized Model match (try variations)
        # e.g. "HTM6 S3" vs "HTM6-S3"
        variations = [
            sku.replace(" ", "-"),
            sku.replace("-", " "),
            sku.replace(" ", ""),
            sku.replace("-", "")
        ]
        
        for var in variations:
            product = await self.opencart.get_product_by_model(var)
            if product:
                return product
                
        return None

    async def _detect_changes(self, upload_id: str, supplier_name: str, product: ProductData, instruction: str, markup_pct: Optional[float] = None) -> int:
        """
        Compare product data with OpenCart and:
        1. Queue price changes if > 10%
        2. Sync stock quantity immediately
        3. Sync stock status (In Stock/Out of Stock) immediately
        """
        changes = 0
        
        try:
            # 1. Try robust SKU/Model match first
            oc_product = await self._find_existing_product(product.sku)
            
            # 2. If no match, try fuzzy name matching using search
            if not oc_product and product.name:
                from difflib import SequenceMatcher
                
                # Strategy: Try increasingly broad searches to find candidates
                search_queries = [
                    product.name,  # Full name
                    " ".join(product.name.split()[:3]),  # First 3 words
                    " ".join(product.name.split()[:2]),  # First 2 words
                    product.name.split()[0],             # First word (Critical for "Zeppelin Wall-mount")
                    max(product.name.split(), key=len)   # Longest word
                ]
                
                candidates = []
                seen_ids = set()
                
                for query in search_queries:
                    if len(query) < 3: continue
                    
                    results = await self.opencart.search_products_by_name(query)
                    for res in results:
                        if res['product_id'] not in seen_ids:
                            candidates.append(res)
                            seen_ids.add(res['product_id'])
                    
                    # If we found good candidates, stop searching
                    if len(candidates) > 5:
                        break
                
                # Normalize the incoming product name
                normalized_new = self._normalize_string(product.name)
                
                best_match = None
                best_ratio = 0.0
                
                for oc_prod in candidates:
                    oc_name = oc_prod.get('name', '')
                    normalized_oc = self._normalize_string(oc_name)
                    
                    # Calculate similarity ratio
                    ratio = SequenceMatcher(None, normalized_new, normalized_oc).ratio()
                    
                    # Boost ratio if SKU is contained in Name (common pattern)
                    if product.sku and len(product.sku) > 3 and product.sku.lower() in normalized_oc:
                        ratio += 0.2
                    
                    if ratio > best_ratio:
                        best_ratio = ratio
                        best_match = oc_prod
                
                # If >65% similar, consider it a match (lowered from 75%)
                if best_ratio > 0.65:
                    logger.info("fuzzy_match_found", 
                               new_sku=product.sku,
                               new_name=product.name,
                               oc_name=best_match.get('name'),
                               similarity=round(best_ratio * 100, 1))
                    oc_product = best_match
            
            # 3. If still no match, it's genuinely new
            if not oc_product:
                logger.info("new_product_discovered", sku=product.sku)
                await self._queue_new_product(supplier_name, product)
                return 0
            
            product_id = oc_product['product_id']
            
            # Get supplier ID from supplier_name
            supplier_response = self.supabase.client.table("suppliers")\
                .select("id")\
                .eq("name", supplier_name)\
                .single()\
                .execute()
            
            supplier_id = supplier_response.data['id'] if supplier_response.data else None
            
            # --- PRICE CHECKS ---
            if product.price is not None and supplier_id:
                # Calculate retail price using pricing rules AND instruction
                retail_price = await self.calculate_retail_price(
                    product.price, 
                    supplier_id,
                    product.name, # Use name as category for now
                    instruction,
                    supplier_name,
                    markup_pct
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
                        "product_id": product_id,
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
            
            # --- STOCK CHECKS ---
            if product.stock is not None:
                current_stock = int(oc_product.get('quantity', 0))
                
                if product.stock != current_stock:
                    # We DO NOT update stock from file anymore (per user request)
                    # We only log that there is a difference for debugging
                    logger.debug("stock_mismatch_ignored", 
                                sku=product.sku, 
                                file_stock=product.stock, 
                                oc_stock=current_stock)
        
        except Exception as e:
            logger.error("detect_changes_failed", sku=product.sku, error=str(e))
        
        return changes
    
    async def _process_discontinued_products(self, supplier_name: str, extracted_skus: set, products: List[ProductData]) -> int:
        """
        Identify products present in the database but missing from the current upload.
        """
        try:
            # 1. Get all known SKUs for this supplier from supplier_catalogs
            # Note: This might be heavy if a supplier has thousands of products.
            response = self.supabase.client.table("supplier_catalogs")\
                .select("sku")\
                .eq("supplier_name", supplier_name)\
                .execute()
            
            if not response.data:
                return 0
                
            existing_skus = {item['sku'] for item in response.data}
            
            # 2. Find difference
            discontinued_skus = existing_skus - extracted_skus
            
            if not discontinued_skus:
                return 0
                
            logger.info("discontinued_products_detected", 
                       supplier=supplier_name, 
                       count=len(discontinued_skus),
                       skus=list(discontinued_skus)[:10]) # Log first 10
            
            # 3. Mark as discontinued (if we had a status column) or just log
            # For now, we will just log them as we don't want destructive updates without being sure of schema.
            
            return len(discontinued_skus)
            
        except Exception as e:
            logger.error("process_discontinued_failed", error=str(e))
            return 0

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
