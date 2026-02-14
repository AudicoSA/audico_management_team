import json
import os
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
    Deduplicates by SKU to prevent the same product appearing multiple times.
    """
    sb = get_supabase_connector()

    try:
        unmatched_data = []
        seen_skus = set()  # Track SKUs we've already added to prevent loops
        offset = 0
        fetch_batch = 200
        max_iterations = 10

        while len(unmatched_data) < limit and offset < (fetch_batch * max_iterations):
            # 1. Get a batch of products (most recent first)
            products_response = sb.client.table("products")\
                .select("id, sku, product_name, description, selling_price")\
                .gt("selling_price", 0)\
                .order("created_at", desc=True)\
                .range(offset, offset + fetch_batch - 1)\
                .execute()

            if not products_response.data:
                break

            # 2. Get product IDs from this batch
            product_ids = [p['id'] for p in products_response.data]

            # 3. Check which are already matched
            matched_ids = set()
            for i in range(0, len(product_ids), 50):
                chunk = product_ids[i:i+50]
                matches_response = sb.client.table("product_matches")\
                    .select("internal_product_id")\
                    .in_("internal_product_id", chunk)\
                    .execute()
                matched_ids.update(m['internal_product_id'] for m in matches_response.data)

            # 4. Also check if ANY duplicate of this SKU is already matched
            # This prevents showing duplicates of already-linked products
            batch_skus = list(set(p.get('sku', '') for p in products_response.data if p.get('sku')))
            matched_skus = set()
            for i in range(0, len(batch_skus), 50):
                sku_chunk = batch_skus[i:i+50]
                # Find all product IDs with these SKUs
                sku_products = sb.client.table("products")\
                    .select("id, sku")\
                    .in_("sku", sku_chunk)\
                    .execute()
                sku_to_ids = {}
                for sp in sku_products.data:
                    sku_to_ids.setdefault(sp['sku'], []).append(sp['id'])

                # Check if ANY id for each SKU is matched
                all_ids_for_skus = [sp['id'] for sp in sku_products.data]
                for j in range(0, len(all_ids_for_skus), 50):
                    id_chunk = all_ids_for_skus[j:j+50]
                    m_resp = sb.client.table("product_matches")\
                        .select("internal_product_id")\
                        .in_("internal_product_id", id_chunk)\
                        .execute()
                    for m in m_resp.data:
                        # Find which SKU this matched ID belongs to
                        for sku, ids in sku_to_ids.items():
                            if m['internal_product_id'] in ids:
                                matched_skus.add(sku)

            # 5. Filter, deduplicate by SKU, and format results
            for p in products_response.data:
                sku = p.get('sku', '')

                # Skip if this specific ID is matched
                if p['id'] in matched_ids:
                    continue

                # Skip if ANY duplicate of this SKU is already matched
                if sku in matched_skus:
                    continue

                # Skip if we've already added this SKU (dedup within results)
                if sku in seen_skus:
                    continue

                seen_skus.add(sku)
                unmatched_data.append({
                    "id": p['id'],
                    "sku": sku,
                    "name": p['product_name'],
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
        "name": product.get("product_name"), # Fix: use product_name
        "price": product.get("selling_price") # Fix: use selling_price
    }
    
    candidates = await engine.find_matches(supplier_data)
    return candidates

@router.post("/link")
async def link_product(request: LinkRequest):
    """
    Create a link in product_matches table.
    Also links ALL duplicate rows with the same SKU to prevent them reappearing.
    """
    sb = get_supabase_connector()

    try:
        # 1. Link the selected product
        data = {
            "internal_product_id": request.internal_product_id,
            "opencart_product_id": request.opencart_product_id,
            "match_type": request.match_type,
            "score": request.confidence
        }

        sb.client.table("product_matches").insert(data).execute()
        logger.info("product_linked", **data)

        # 2. Find and link ALL duplicates of the same SKU
        product = sb.client.table("products").select("sku").eq("id", request.internal_product_id).single().execute()
        if product.data and product.data.get('sku'):
            sku = product.data['sku']
            # Find all products with same SKU
            dupes = sb.client.table("products").select("id").eq("sku", sku).execute()
            dupe_ids = [d['id'] for d in dupes.data if d['id'] != request.internal_product_id]

            if dupe_ids:
                # Check which dupes are already matched
                existing = sb.client.table("product_matches")\
                    .select("internal_product_id")\
                    .in_("internal_product_id", dupe_ids)\
                    .execute()
                already_matched = set(m['internal_product_id'] for m in existing.data)

                # Link unmatched dupes as "duplicate_linked"
                for dupe_id in dupe_ids:
                    if dupe_id not in already_matched:
                        sb.client.table("product_matches").insert({
                            "internal_product_id": dupe_id,
                            "opencart_product_id": request.opencart_product_id,
                            "match_type": "duplicate_linked",
                            "score": request.confidence
                        }).execute()

                logger.info("duplicates_linked", sku=sku, count=len(dupe_ids) - len(already_matched))

        return {"status": "success", "data": data}

    except Exception as e:
        logger.error("link_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/ignore")
async def ignore_product(request: IgnoreRequest):
    """
    Ignore a product by creating a match entry with NULL opencart_id.
    Also ignores ALL duplicate rows with the same SKU.
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

        # Also ignore ALL duplicates of the same SKU
        product = sb.client.table("products").select("sku").eq("id", request.internal_product_id).single().execute()
        if product.data and product.data.get('sku'):
            sku = product.data['sku']
            dupes = sb.client.table("products").select("id").eq("sku", sku).execute()
            dupe_ids = [d['id'] for d in dupes.data if d['id'] != request.internal_product_id]

            if dupe_ids:
                existing = sb.client.table("product_matches")\
                    .select("internal_product_id")\
                    .in_("internal_product_id", dupe_ids)\
                    .execute()
                already_matched = set(m['internal_product_id'] for m in existing.data)

                for dupe_id in dupe_ids:
                    if dupe_id not in already_matched:
                        sb.client.table("product_matches").insert({
                            "internal_product_id": dupe_id,
                            "opencart_product_id": None,
                            "match_type": "ignored",
                            "score": 0
                        }).execute()

                logger.info("duplicates_ignored", sku=sku, count=len(dupe_ids) - len(already_matched))

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
        final_name = product.get("product_name")

        # User Logic: Round cost price to nearest R10 (floor/no cents)
        raw_price = product.get("cost_price") or product.get("selling_price", 0)
        rounded_price = int(raw_price // 10) * 10
        
        queue_data = {
            "supplier_name": supplier_name,
            "sku": product.get("sku"),
            "name": final_name,
            "cost_price": rounded_price,
            "selling_price": product.get("selling_price", 0),
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


# ============================================================================
# CLEANUP ENDPOINTS
# ============================================================================

@router.delete("/duplicates")
async def delete_duplicate_skus():
    """
    Find and delete duplicate products (same supplier + SKU).
    Keeps products with existing matches, or the oldest if none are matched.
    """
    sb = get_supabase_connector()
    
    try:
        from collections import defaultdict
        
        # Get all products
        all_products = sb.client.table("products")\
            .select("id, sku, supplier_id, product_name, created_at")\
            .execute()

        # Group by (supplier_id, sku)
        groups = defaultdict(list)
        for p in all_products.data:
            key = (p.get('supplier_id'), p.get('sku'))
            groups[key].append(p)

        # Find duplicates
        duplicates = {k: v for k, v in groups.items() if len(v) > 1}

        to_delete = []
        matched_kept = 0
        oldest_kept = 0

        for (supplier_id, sku), products in duplicates.items():
            # Sort by created_at (oldest first)
            products.sort(key=lambda x: x.get('created_at', ''))

            # Check which ones have matches
            product_ids = [p['id'] for p in products]
            matches = sb.client.table("product_matches")\
                .select("internal_product_id")\
                .in_("internal_product_id", product_ids)\
                .execute()

            matched_ids = {m['internal_product_id'] for m in matches.data}

            # Keep matched or oldest, delete the rest
            if matched_ids:
                keep = next(p for p in products if p['id'] in matched_ids)
                delete = [p for p in products if p['id'] != keep['id']]
                matched_kept += 1
            else:
                keep = products[0]
                delete = products[1:]
                oldest_kept += 1

            to_delete.extend(delete)

        # Delete duplicates in batches
        deleted_count = 0
        if to_delete:
            delete_ids = [p['id'] for p in to_delete]
            for i in range(0, len(delete_ids), 100):
                batch = delete_ids[i:i+100]
                sb.client.table("products").delete().in_("id", batch).execute()
                deleted_count += len(batch)

        logger.info("duplicates_deleted", total=deleted_count, matched_kept=matched_kept, oldest_kept=oldest_kept)
        
        return {
            "status": "success",
            "duplicates_found": len(duplicates),
            "products_deleted": deleted_count,
            "matched_kept": matched_kept,
            "oldest_kept": oldest_kept,
            "message": f"Deleted {deleted_count} duplicate products, kept {matched_kept} with matches and {oldest_kept} oldest unmatched"
        }
        
    except Exception as e:
        logger.error("delete_duplicates_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/link-manual")
async def link_product_manual(request: dict):
    """
    Manually link a product using OpenCart product URL or ID.
    
    Request body:
    {
        "internal_product_id": "uuid",
        "opencart_url_or_id": "https://audicoonline.co.za/...?product_id=123" or "123"
    }
    """
    sb = get_supabase_connector()
    
    try:
        internal_id = request.get("internal_product_id")
        url_or_id = request.get("opencart_url_or_id")
        
        if not internal_id or not url_or_id:
            raise HTTPException(status_code=400, detail="Missing internal_product_id or opencart_url_or_id")
        
        # Extract product_id from URL or use directly
        import re
        import requests as req

        # Try different extraction methods
        opencart_product_id = None

        # Method 1: Check for product_id= in URL
        if isinstance(url_or_id, str) and "product_id=" in url_or_id:
            match = re.search(r'product_id=(\d+)', url_or_id)
            if match:
                opencart_product_id = int(match.group(1))

        # Method 2: Try direct integer conversion
        if opencart_product_id is None:
            try:
                opencart_product_id = int(url_or_id)
            except (ValueError, TypeError):
                pass

        # Method 3: Fetch SEO-friendly URL and extract product_id from HTML
        if opencart_product_id is None and isinstance(url_or_id, str) and url_or_id.startswith('http'):
            try:
                response = req.get(url_or_id, timeout=10)
                # Look for product_id in the HTML (OpenCart often includes it in forms, links, etc.)
                id_match = re.search(r'product_id["\']?\s*[:=]\s*["\']?(\d+)', response.text)
                if id_match:
                    opencart_product_id = int(id_match.group(1))
                else:
                    # Try another pattern - input field with name="product_id"
                    id_match2 = re.search(r'<input[^>]+name=["\']product_id["\'][^>]+value=["\'](\d+)["\']', response.text)
                    if id_match2:
                        opencart_product_id = int(id_match2.group(1))
            except Exception as e:
                logger.warning("url_fetch_failed", url=url_or_id, error=str(e))

        if opencart_product_id is None:
            raise HTTPException(status_code=400, detail="Could not extract product_id. Please provide product ID number or URL with ?product_id=")
        
        # Create the link
        link_data = {
            "internal_product_id": internal_id,
            "opencart_product_id": opencart_product_id,
            "match_type": "manual",
            "score": 100
        }
        
        sb.client.table("product_matches").insert(link_data).execute()
        logger.info("manual_link_created", internal_id=internal_id, opencart_id=opencart_product_id)
        
        return {
            "status": "success",
            "message": f"Manually linked product to OpenCart ID {opencart_product_id}",
            "data": link_data
        }
        
    except Exception as e:
        logger.error("manual_link_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/clear-unmatched")
async def clear_unmatched_queue(batch_limit: int = 1000):
    """
    Bulk ignore unmatched products by marking them as 'ignored'.
    Processes products in batches to avoid timeout.

    Query params:
    - batch_limit: Maximum number of products to process (default 1000, max 5000)
    """
    sb = get_supabase_connector()

    try:
        # Limit to prevent abuse
        batch_limit = min(batch_limit, 5000)
        logger.info("clear_unmatched_started", batch_limit=batch_limit)

        # Fetch a batch of products (any products, not just recent)
        # We fetch 2x batch_limit to account for already-matched ones
        products_response = sb.client.table("products")\
            .select("id")\
            .gt("selling_price", 0)\
            .limit(batch_limit * 2)\
            .execute()

        if not products_response.data:
            return {
                "status": "success",
                "ignored": 0,
                "message": "No products found to ignore"
            }

        # Get all product IDs
        all_product_ids = [p['id'] for p in products_response.data]

        # Check which are already matched (in chunks for efficiency)
        matched_ids = set()
        for i in range(0, len(all_product_ids), 100):
            chunk = all_product_ids[i:i+100]
            matches_response = sb.client.table("product_matches")\
                .select("internal_product_id")\
                .in_("internal_product_id", chunk)\
                .execute()
            matched_ids.update(m['internal_product_id'] for m in matches_response.data)

        # Get truly unmatched IDs
        unmatched_ids = [pid for pid in all_product_ids if pid not in matched_ids][:batch_limit]

        if not unmatched_ids:
            return {
                "status": "success",
                "ignored": 0,
                "message": "No unmatched products found"
            }

        # Create ignore records
        ignore_records = [
            {
                "internal_product_id": pid,
                "opencart_product_id": None,
                "match_type": "ignored",
                "score": 0
            }
            for pid in unmatched_ids
        ]

        # Insert in batches of 100
        inserted_count = 0
        for i in range(0, len(ignore_records), 100):
            batch = ignore_records[i:i+100]
            sb.client.table("product_matches").insert(batch).execute()
            inserted_count += len(batch)

        logger.info("clear_unmatched_completed", ignored=inserted_count)

        return {
            "status": "success",
            "ignored": inserted_count,
            "total_remaining": f"Call again if more products need clearing",
            "message": f"Successfully ignored {inserted_count} unmatched products"
        }

    except Exception as e:
        logger.error("clear_unmatched_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))
