from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional
from src.aligner.engine import AlignmentEngine
from src.connectors.supabase import get_supabase_connector, SupabaseConnector
from src.utils.logging import AgentLogger

router = APIRouter(tags=["Alignment"], prefix="/api/alignment")
logger = AgentLogger("alignment_api")

class LinkRequest(BaseModel):
    internal_product_id: str # UUID
    opencart_product_id: int
    match_type: str = "manual"
    confidence: int = 100

class IgnoreRequest(BaseModel):
    internal_product_id: str 
    match_type: str = "ignored"

class SupplierProduct(BaseModel):
    id: str # UUID
    sku: str
    name: str
    description: Optional[str] = None
    price: float
    supplier: Optional[str] = None

@router.get("/unmatched")
async def get_unmatched_products(limit: int = 20):
    """
    Get products from Supabase 'products' table that do NOT have an entry in 'product_matches'.
    """
    sb = get_supabase_connector()
    
    try:
        # 1. Get all matched IDs first
        # Note: distinct() is good practice here if one product could match multiple (though unlikely in current schema)
        matches = sb.client.table("product_matches").select("internal_product_id").execute()
        matched_ids = [m['internal_product_id'] for m in matches.data]
        
        # 2. Query products NOT in the matched list
        query = sb.client.table("products")\
            .select("id, sku, product_name, description, selling_price")\
            .order("created_at", desc=True)\
            .limit(limit)
            
        if matched_ids:
            query = query.not_.in_("id", matched_ids)
            
        products = query.execute()
        
        # 3. Format result
        unmatched_data = []
        for p in products.data:
            unmatched_data.append({
                "id": p['id'],
                "sku": p['sku'],
                "name": p['product_name'], 
                "description": p.get('description'),
                "price": p.get('selling_price', 0),
                "supplier": "Internal" 
            })
        
        return unmatched_data
        
    except Exception as e:
        logger.error("fetch_unmatched_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/candidates/{internal_product_id}")
async def get_candidates(internal_product_id: str):
    """
    Run Alignment Engine to find candidates for a specific internal product.
    """
    sb = get_supabase_connector()
    engine = AlignmentEngine()
    
    # Fetch product details
    p_response = sb.client.table("products").select("*").eq("id", internal_product_id).single().execute()
    product = p_response.data
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    supplier_data = {
        "sku": product.get("sku"),
        "name": product.get("product_name"), # Fix: use product_name
        "price": product.get("selling_price") # Fix: use selling_price
    }
    
    candidates = await engine.find_matches(supplier_data)
    return candidates

@router.post("/link")
async def link_product(request: LinkRequest):
    """
    Create a link in product_matches table.
    """
    sb = get_supabase_connector()
    
    try:
        data = {
            "internal_product_id": request.internal_product_id,
            "opencart_product_id": request.opencart_product_id,
            "match_type": request.match_type,
            "score": request.confidence
        }
        
        sb.client.table("product_matches").insert(data).execute()
        logger.info("product_linked", **data)
        return {"status": "success", "data": data}
        
    except Exception as e:
        logger.error("link_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/ignore")
async def ignore_product(request: IgnoreRequest):
    """
    Ignore a product by creating a match entry with NULL opencart_id.
    """
    sb = get_supabase_connector()
    
    try:
        data = {
            "internal_product_id": request.internal_product_id,
            "opencart_product_id": None,
            "match_type": "ignored",
            "score": 0
        }
        
        sb.client.table("product_matches").insert(data).execute()
        logger.info("product_ignored", internal_id=request.internal_product_id)
        return {"status": "success", "data": data}
        
    except Exception as e:
        logger.error("ignore_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))

class CreateRequest(BaseModel):
    internal_product_id: str 

@router.post("/create")
async def create_product(request: CreateRequest):
    """
    Add product to new_products_queue and mark as pending_creation.
    """
    sb = get_supabase_connector()
    
    try:
        # 1. Fetch product details
        p_response = sb.client.table("products").select("*").eq("id", request.internal_product_id).single().execute()
        product = p_response.data
        
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")

        # 2. Prepare Queue Data
        # A. Get Supplier Name
        supplier_name = "Internal-Alignment"
        if product.get("supplier_id"):
            sup_res = sb.client.table("suppliers").select("name").eq("id", product.get("supplier_id")).single().execute()
            if sup_res.data:
                supplier_name = sup_res.data['name']
        
        # Use Product Name directly as it comes from the feed (e.g. "Ubiquiti UniFi...")
        # Description often contains HTML or is too long for a name.
        final_name = product.get("product_name")

        # User Logic: Round cost price to nearest R10 (floor/no cents)
        raw_price = product.get("cost_price") or product.get("selling_price", 0)
        rounded_price = int(raw_price // 10) * 10
        
        queue_data = {
            "supplier_name": supplier_name,
            "sku": product.get("sku"),
            "name": final_name,
            "cost_price": rounded_price,
            "stock_level": product.get("total_stock", 0),
            "status": "pending"
        }
        
        sb.client.table("new_products_queue").insert(queue_data).execute()

        # 3. Mark as matched (pending_creation) so it leaves the unmatched list
        match_data = {
            "internal_product_id": request.internal_product_id,
            "opencart_product_id": None,
            "match_type": "pending_creation",
            "score": 0
        }
        sb.client.table("product_matches").insert(match_data).execute()
        
        logger.info("product_queued_for_creation", internal_id=request.internal_product_id)
        return {"status": "success", "data": queue_data}
        
    except Exception as e:
        logger.error("create_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))
