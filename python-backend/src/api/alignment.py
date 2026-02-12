import json
import os
import html
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional
from src.aligner.engine import AlignmentEngine
from src.connectors.supabase import get_supabase_connector, SupabaseConnector
from src.utils.logging import AgentLogger

# Category engine - lazy loaded
_category_engine = None

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
    Optimized to handle large datasets without hitting query size limits.
    """
    sb = get_supabase_connector()
    
    try:
        # Strategy: Fetch products in pages until we find enough unmatched ones
        # This handles the case where recent products are all matched
        
        unmatched_data = []
        offset = 0
        fetch_batch = 200  # Fetch 200 at a time
        max_iterations = 10  # Don't fetch more than 2000 products
        
        while len(unmatched_data) < limit and offset < (fetch_batch * max_iterations):
            # 1. Get a batch of products
            products_response = sb.client.table("products")\
                .select("id, sku, product_name, description, selling_price")\
                .gt("selling_price", 0)\
                .order("created_at", desc=True)\
                .range(offset, offset + fetch_batch - 1)\
                .execute()
            
            if not products_response.data:
                break  # No more products
            
            # 2. Get product IDs from this batch
            product_ids = [p['id'] for p in products_response.data]
            
            # 3. Check which of these IDs are already matched (in smaller chunks)
            matched_ids = set()
            for i in range(0, len(product_ids), 50):
                chunk = product_ids[i:i+50]
                matches_response = sb.client.table("product_matches")\
                    .select("internal_product_id")\
                    .in_("internal_product_id", chunk)\
                    .execute()
                matched_ids.update(m['internal_product_id'] for m in matches_response.data)
            
            # 4. Filter and format results
            for p in products_response.data:
                if p['id'] not in matched_ids:
                    unmatched_data.append({
                        "id": p['id'],
                        "sku": p['sku'],
                        # FIX: Decode HTML entities for display
                        "name": html.unescape(p['product_name'] or ""), 
                        "description": p.get('description'),
                        "price": p.get('selling_price', 0),
                        "supplier": "Internal" 
                    })
                    
                    if len(unmatched_data) >= limit:
                        break
            
            offset += fetch_batch
        
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
        # FIX: Decode HTML entities for display
        "name": html.unescape(product.get("product_name") or ""), # Fix: use product_name
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

class AutoLinkRequest(BaseModel):
    confidence_threshold: int = 100
    batch_size: int = 50

@router.post("/auto-link")
async def auto_link_products(request: AutoLinkRequest):
    """
    Automatically link products that match with high confidence (default 100%).
    Scans unmatched products and runs alignment engine.
    """
    sb = get_supabase_connector()
    engine = AlignmentEngine()
    
    try:
        # 1. Fetch unmatched products (reuse logic or fetch larger batch)
        # We'll fetch a batch of recent unmatched products
        # Logic similar to get_unmatched_products but we need just ID and details
        
        # Determine unmatched IDs first to be efficient
        # Fetch 200 recent products
        products_response = sb.client.table("products")\
            .select("id, sku, product_name, selling_price")\
            .gt("selling_price", 0)\
            .order("created_at", desc=True)\
            .limit(request.batch_size * 4)\
            .execute() # Fetch 4x batch size to find enough unmatched
            
        if not products_response.data:
            return {"status": "success", "aligned": 0, "processed": 0, "message": "No products found"}

        # Filter out already matched
        product_ids = [p['id'] for p in products_response.data]
        matches_response = sb.client.table("product_matches")\
            .select("internal_product_id")\
            .in_("internal_product_id", product_ids)\
            .execute()
            
        matched_ids = set(m['internal_product_id'] for m in matches_response.data)
        unmatched = [p for p in products_response.data if p['id'] not in matched_ids] # Limit to batch size not needed if we process all found
        
        aligned_count = 0
        processed_count = 0
        
        for p in unmatched[:request.batch_size]: # Respect batch limit
            processed_count += 1
            
            # Run Alignment
            supplier_data = {
                "sku": p.get("sku"),
                "name": p.get("product_name"),
                "price": p.get("selling_price")
            }
            
            candidates = await engine.find_matches(supplier_data)
            
            # Check for high confidence match
            if candidates and candidates[0]['confidence'] >= request.confidence_threshold:
                best_match = candidates[0]
                
                # Link it
                link_data = {
                    "internal_product_id": p['id'],
                    "opencart_product_id": best_match['product']['product_id'],
                    "match_type": best_match['match_type'], # e.g. "exact_sku"
                    "score": best_match['confidence']
                }
                
                sb.client.table("product_matches").insert(link_data).execute()
                aligned_count += 1
                logger.info("auto_aligned", product=p['product_name'], match=best_match['product']['name'])
        
        return {
            "status": "success",
            "aligned": aligned_count,
            "processed": processed_count,
            "message": f"Successfully aligned {aligned_count} products out of {processed_count} scanned."
        }

    except Exception as e:
        logger.error("auto_link_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))

class CreateRequest(BaseModel):
    internal_product_id: str
    name: Optional[str] = None # Optional override from frontend
    category_ids: Optional[List[int]] = None  # Optional category IDs for the new product

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
        # FIX: Decode HTML entities (e.g. &#8243; -> ")
        # Allow frontend override
        final_name = request.name or html.unescape(product.get("product_name") or "")

        # User Logic: Round cost/selling price to nearest R10 if > 100
        # Check source of prices
        cost_p = product.get("cost_price", 0)
        sell_p = product.get("selling_price", 0)
        
        q_cost = cost_p
        q_sell = sell_p
        
        if sell_p > 0:
            # Selling-price based (e.g. ProAudio)
            # Only round if > 100
            if sell_p > 100:
                q_sell = round(sell_p / 10) * 10
            # Keep q_cost as is (likely 0)
        elif cost_p > 0:
            # Cost-price based (e.g. Nology)
            if cost_p > 100:
                q_cost = round(cost_p / 10) * 10
            # Keep q_sell as 0

        
        queue_data = {
            "supplier_name": supplier_name,
            "sku": product.get("sku"),
            "name": final_name,
            "cost_price": q_cost,
            "selling_price": q_sell,
            "stock_level": product.get("total_stock", 0),
            "status": "pending",
            "category_ids": request.category_ids or []  # Store category IDs for product creation
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


# ============================================================================
# CATEGORY ENDPOINTS
# ============================================================================

def get_category_engine():
    """
    Lazy load the category engine with the approved category tree.
    """
    global _category_engine
    
    if _category_engine is None:
        # Try to load from JSON file first
        tree_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
            "approved_category_tree.json"
        )
        
        if os.path.exists(tree_path):
            try:
                from src.categorizer.engine import CategoryEngine
                with open(tree_path, 'r', encoding='utf-8') as f:
                    tree_data = json.load(f)
                category_tree = tree_data.get('category_tree', tree_data)
                _category_engine = CategoryEngine(category_tree)
                logger.info("category_engine_loaded", path=tree_path)
            except Exception as e:
                logger.error("category_engine_load_failed", error=str(e))
                return None
        else:
            logger.warning("category_tree_not_found", path=tree_path)
            return None
    
    return _category_engine


@router.get("/categories")
async def get_categories():
    """
    Get all available categories from the approved tree.
    Returns flat list with paths for dropdown selection.
    """
    engine = get_category_engine()
    
    if not engine:
        # Fallback: try to load from OpenCart directly
        from src.connectors.opencart import OpenCartConnector
        oc = OpenCartConnector()
        conn = oc._get_connection()
        
        try:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT 
                        c.category_id,
                        cd.name,
                        c.parent_id
                    FROM oc_category c
                    JOIN oc_category_description cd ON c.category_id = cd.category_id
                    WHERE cd.language_id = 1 AND c.status = 1
                    ORDER BY c.parent_id, c.sort_order
                """)
                
                categories = cursor.fetchall()
                
                # Build paths
                id_to_name = {}
                id_to_parent = {}
                for cat in categories:
                    if isinstance(cat, dict):
                        id_to_name[cat['category_id']] = cat['name']
                        id_to_parent[cat['category_id']] = cat['parent_id']
                    else:
                        id_to_name[cat[0]] = cat[1]
                        id_to_parent[cat[0]] = cat[2]
                
                def build_path(cat_id):
                    path_parts = []
                    current_id = cat_id
                    while current_id and current_id in id_to_name:
                        path_parts.insert(0, id_to_name[current_id])
                        current_id = id_to_parent.get(current_id, 0)
                    return " > ".join(path_parts)
                
                result = []
                for cat in categories:
                    cat_id = cat['category_id'] if isinstance(cat, dict) else cat[0]
                    cat_name = cat['name'] if isinstance(cat, dict) else cat[1]
                    result.append({
                        "id": cat_id,
                        "name": cat_name,
                        "path": build_path(cat_id)
                    })
                
                return result
                
        finally:
            conn.close()
    
    # Return categories from engine
    return [
        {"id": info.get("id"), "name": info.get("name"), "path": path}
        for path, info in engine.flat_categories.items()
    ]


@router.get("/suggest-category/{internal_product_id}")
async def suggest_category(internal_product_id: str):
    """
    Get AI-suggested category for a product before creation.
    Uses the CategoryEngine to analyze the product and suggest categories.
    """
    sb = get_supabase_connector()
    engine = get_category_engine()
    
    # Fetch product details
    p_response = sb.client.table("products").select("*").eq("id", internal_product_id).single().execute()
    product = p_response.data
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    if not engine:
        # No category engine available - return empty suggestion
        return {
            "primary_category": None,
            "secondary_categories": [],
            "confidence": 0,
            "reasoning": "Category engine not configured. Please create and approve a category tree first.",
            "available": False
        }
    
    try:
        # Build product data for categorization
        product_data = {
            "product_id": internal_product_id,
            "name": product.get("product_name", ""),
            "sku": product.get("sku", ""),
            "model": product.get("sku", ""),  # Use SKU as model
            "description_snippet": product.get("description", "")[:500] if product.get("description") else "",
            "manufacturer": product.get("brand", ""),
            "price": product.get("selling_price", 0)
        }
        
        # Get AI suggestion
        assignment = await engine.categorize_product(product_data, allow_multiple=True)
        
        return {
            "primary_category": {
                "id": assignment.primary_category_id,
                "path": assignment.primary_category_path
            },
            "secondary_categories": [
                {"id": cid, "path": path} 
                for cid, path in zip(assignment.secondary_category_ids, assignment.secondary_category_paths)
            ],
            "confidence": assignment.confidence,
            "reasoning": assignment.reasoning,
            "available": True
        }
        
    except Exception as e:
        logger.error("category_suggestion_failed", error=str(e))
        return {
            "primary_category": None,
            "secondary_categories": [],
            "confidence": 0,
            "reasoning": f"Error generating suggestion: {str(e)}",
            "available": False
        }
