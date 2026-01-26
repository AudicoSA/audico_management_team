import logging
import json
import base64
from typing import Dict, Any, List, Optional
from src.connectors.supabase import get_supabase_connector
from src.utils.config import get_config
from openai import OpenAI
from datetime import datetime

logger = logging.getLogger("SpecialsAgent")

class SpecialsAgent:
    """
    Agent for processing Supplier Specials (Flyers/Images) using Vision.
    """

    def __init__(self):
        self.sb = get_supabase_connector()
        self.config = get_config()
        self.client = OpenAI(api_key=self.config.openai_api_key)
        self.model = "gpt-4o" # Vision requires 4o or 4o-mini

    async def ingest_flyer(self, file_path: str, supplier_name: str = "Unknown") -> Dict[str, Any]:
        """
        Process a flyer image/PDF, extract deals, and save to DB.
        """
        logger.info(f"Ingesting flyer: {file_path} from {supplier_name}")
        
        try:
            # 1. Encode Image
            # TODO: Handle PDF conversion to image if needed. For now assuming Image (JPG/PNG).
            if file_path.lower().endswith(".pdf"):
                # Fallback: Try to extract text directly from PDF
                import PyPDF2
                try:
                    text_content = ""
                    with open(file_path, "rb") as f:
                        reader = PyPDF2.PdfReader(f)
                        for page in reader.pages:
                            text_content += page.extract_text() + "\n"
                    
                    return await self.ingest_text_flyer(text_content, supplier_name, source_ref=file_path)

                except Exception as ex:
                     return {"status": "error", "message": f"PDF parsing failed: {ex}. Please send an Image (JPG/PNG) for best results."}
            else:
                # Image Flow (Vision)
                with open(file_path, "rb") as image_file:
                    base64_image = base64.b64encode(image_file.read()).decode('utf-8')

                # 2. Call OpenAI Vision
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": "Extract all product deals from this supplier flyer. Return a JSON structure with a list of deals. For each deal capture: 'product_name', 'price' (numeric/string), 'sku' (if visible), 'valid_until' (if visible). Also extract the flyer title and valid_until date for the whole flyer if present."},
                                {
                                    "type": "image_url",
                                    "image_url": {
                                        "url": f"data:image/jpeg;base64,{base64_image}"
                                    },
                                },
                            ],
                        }
                    ],
                    response_format={"type": "json_object"},
                    max_tokens=2000,
                )
                
                result = json.loads(response.choices[0].message.content)
            
            # Shared Saving Logic
            return await self._save_results(result, supplier_name, source=file_path)

        except Exception as e:
            logger.error(f"Error processing flyer: {e}")
            return {"status": "error", "message": str(e)}

    async def ingest_text_flyer(self, text_content: str, supplier_name: str = "Unknown", source_ref: str = "Email Body") -> Dict[str, Any]:
        """
        Process raw text from an email/PDF to find specials.
        """
        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini", 
                messages=[
                    {
                        "role": "user",
                        "content": f"Extract all product deals from this supplier flyer text. Return a JSON structure with a list of deals. For each deal capture: 'product_name', 'price' (numeric/string), 'sku' (if visible), 'valid_until' (if visible). Also extract the flyer title (e.g. 'Month End Specials') and valid_until date for the whole flyer if present.\n\nText:\n{text_content[:15000]}"
                    }
                ],
                response_format={"type": "json_object"}
            )
            result = json.loads(response.choices[0].message.content)
            return await self._save_results(result, supplier_name, source=source_ref)
            
        except Exception as e:
            logger.error(f"Error processing text flyer: {e}")
            return {"status": "error", "message": str(e)}

    async def _save_results(self, result: Dict[str, Any], supplier_name: str, source: str) -> Dict[str, Any]:
        """Internal helper to save deals to DB."""
        try:
            # Resolve Supplier ID
            supplier_id = None
            if supplier_name != "Unknown":
                # Look up supplier
                res = self.sb.client.table("suppliers").select("id").ilike("name", f"%{supplier_name}%").limit(1).execute()
                if res.data:
                    supplier_id = res.data[0]['id']
            
            # Save to DB
            deals = result.get("deals", []) or result.get("products", [])
            title = result.get("title") or f"Specials from {supplier_name} - {datetime.now().strftime('%Y-%m-%d')}"
            
            # Clean up Valid Until
            valid_until = result.get("valid_until")
            if valid_until:
                # Try to parse strict ISO or common formats, else None
                # Postgres likes 'YYYY-MM-DD' or ISO.
                # LLM might give '2026-01-30' or '30th January 2026'
                try:
                    from dateutil import parser
                    dt = parser.parse(valid_until, fuzzy=True)
                    # Force year if missing? 
                    # If LLM says "30th January" and today is 2026, parser default behavior?
                    # default=datetime.now() is helpful
                    # Let's simple try strict safe mode:
                    valid_until = dt.isoformat()
                except:
                    # Failed to parse, drop it to avoid DB error
                    logger.warning(f"Could not parse date: {valid_until}")
                    valid_until = None
            
            payload = {
                "supplier_id": supplier_id,
                "title": title,
                "deals": deals,
                "valid_until": valid_until,
                "source_url": source 
            }
            
            self.sb.client.table("supplier_specials").insert(payload).execute()
            
            logger.info("specials_saved", count=len(deals))
            
            # AUTO-SYNC: Push to OpenCart immediately
            try:
                logger.info("Starting Auto-Sync to OpenCart...")
                await self.sync_to_opencart(deals, valid_until)
            except Exception as e:
                logger.error(f"Auto-Sync Failed: {e}")
            
            return {"status": "success", "deals_count": len(deals), "data": payload}
        except Exception as e:
             logger.error(f"Error saving to DB: {e}")
             raise e

    async def sync_to_opencart(self, deals: List[Dict], valid_until: Optional[str]):
        """
        Apply computed specials directly to OpenCart products.
        Formula: (Cost * 1.15 * 1.15) rounded to nearest 10.
        """
        from src.connectors.opencart import get_opencart_connector
        oc = get_opencart_connector()
        
        # Date Logic
        # OpenCart needs YYYY-MM-DD
        date_end = valid_until[:10] if valid_until else "2026-02-28" # Validation needed
        date_start = "0000-00-00"
        
        # Pricing Config
        VAT = 1.15
        MARGIN = 1.15 
        
        updated_count = 0
        
        for deal in deals:
            # 1. Parse Cost
            cost_str = str(deal.get("price", "0")).replace("R", "").replace(" ", "").replace(",", "")
            try:
                cost = float(cost_str)
            except:
                continue

            # 2. Calculate Retail
            retail_price = (cost * VAT) * MARGIN
            # Round to nearest 10
            retail_price = round(retail_price / 10) * 10.0
            
            # 3. Match Product
            sku = deal.get("sku", "")
            name = deal.get("product_name", "")
            
            if not sku and not name: continue
            
            product = None
            if sku:
                product = await oc.get_product_by_sku(sku)
                if not product:
                    product = await oc.get_product_by_model(sku)
            
            if not product and name:
                 # Name Search Fallback
                 candidates = await oc.search_products_by_name(name)
                 if len(candidates) == 1:
                     product = candidates[0]
            
            if product:
                # 4. Apply Special
                # Ensure we clear old ones or just add? 
                # If we clear, we might remove other unrelated specials. 
                # But typically we want THIS special to be authoritative.
                await oc.clear_product_specials(product['product_id'])
                
                await oc.add_product_special(
                    product_id=product['product_id'],
                    price=retail_price,
                    date_start=date_start,
                    date_end=date_end
                )
                updated_count += 1
                logger.info(f"Synced Special: {sku} -> R{retail_price}")
        
        logger.info(f"Auto-Sync Complete. Updated: {updated_count}")

    async def search_specials(self, query: str) -> str:
        """
        Search extracted specials for a product.
        """
        try:
            # We can use Supabase JSON searching or just simple text search on the 'deals' column cast to text.
            # postgres: deals::text ilike '%query%'
            # Supabase-py doesn't support complex casting easily in .filter() without RPC.
            # Let's try .textSearch if enabled, or select all and filter in python (inefficient but works for MVP small data)
            
            # Better: RPC function? Or just fetch recent specials.
            # Let's fetch extracted specials from the last 30 days.
            
            response = self.sb.client.table("supplier_specials").select("*").order("created_at", desc=True).limit(20).execute()
            
            hits = []
            for flyer in response.data:
                deals = flyer.get("deals", [])
                flyer_title = flyer.get("title", "").lower()
                query_lower = query.lower()
                
                # 1. Check if Query matches the Flyer Title (e.g. "Logitech Specials")
                if query_lower in flyer_title:
                   # Return top 10 deals from this matching flyer
                   hits.append(f"--- Found in '{flyer.get('title')}' ---")
                   for d in deals[:10]:
                       hits.append(f"- {d.get('product_name')} @ {d.get('price')}")
                   if len(deals) > 10:
                       hits.append(f"... and {len(deals)-10} more.")
                   continue # Skip individual item check if whole flyer matches
                
                # 2. Check individual items
                for d in deals:
                    p_name = d.get("product_name", "").lower()
                    if query_lower in p_name:
                        hits.append(f"- {d.get('product_name')} @ {d.get('price')} (Source: {flyer.get('title')})")
            
            if not hits:
                return "No specials found matching that query."
            
            return "Found the following specials:\n" + "\n".join(hits)
            
        except Exception as e:
            logger.error(f"Error searching specials: {e}")
            return "Error searching specials."

# Global
_specials_agent: Optional[SpecialsAgent] = None

def get_specials_agent() -> SpecialsAgent:
    global _specials_agent
    if _specials_agent is None:
        _specials_agent = SpecialsAgent()
    return _specials_agent
