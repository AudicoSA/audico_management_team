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
    Get unmatched products, deduplicated by SKU.
    Uses SQL RPC for reliable dedup (no row-limit issues).
    Falls back to Python-side dedup if RPC not available.
    """
    sb = get_supabase_connector()

    try:
        # Try the SQL function first (fast, correct, no row-limit issues)
        try:
            result = sb.client.rpc("get_unmatched_products", {"p_limit": limit}).execute()
            if result.data is not None:
                return [
                    {
                        "id": p['id'],
                        "sku": p['sku'],
                        "name": p['product_name'],
                        "description": p.get('description'),
                        "price": p.get('selling_price', 0),
                        "supplier": "Internal"
                    }
                    for p in result.data
                ]
        except Exception as rpc_err:
            logger.warning("rpc_fallback", error=str(rpc_err))

        # Fallback: Python-side dedup
        # Step 1: Pre-build set of ALL matched SKUs
        matched_skus = set()
        page_offset = 0
        while True:
            matches_batch = sb.client.table("product_matches")\
                .select("internal_product_id")\
                .range(page_offset, page_offset + 999)\
                .execute()
            if not matches_batch.data:
                break

            batch_ids = [m['internal_product_id'] for m in matches_batch.data]
            for i in range(0, len(batch_ids), 100):
                chunk = batch_ids[i:i+100]
                prods = sb.client.table("products").select("sku")\
                    .in_("id", chunk).execute()
                matched_skus.update(p['sku'] for p in prods.data if p.get('sku'))

            if len(matches_batch.data) < 1000:
                break
            page_offset += 1000

        # Step 2: Fetch products, filter by matched SKUs, dedup
        unmatched_data = []
        seen_skus = set()
        offset = 0

        while len(unmatched_data) < limit and offset < 2000:
            products_response = sb.client.table("products")\
                .select("id, sku, product_name, description, selling_price")\
                .gt("selling_price", 0)\
                .order("created_at", desc=True)\
                .range(offset, offset + 199)\
                .execute()

            if not products_response.data:
                break

            for p in products_response.data:
                sku = p.get('sku', '')
                if not sku or sku in matched_skus or sku in seen_skus:
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

            offset += 200

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

        # 2. Find and link ALL duplicates of the same SKU (non-fatal)
        try:
            product = sb.client.table("products").select("sku")\
                .eq("id", request.internal_product_id).limit(1).execute()
            if product.data and product.data[0].get('sku'):
                sku = product.data[0]['sku']
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
                            try:
                                sb.client.table("product_matches").insert({
                                    "internal_product_id": dupe_id,
                                    "opencart_product_id": request.opencart_product_id,
                                    "match_type": "duplicate_linked",
                                    "score": request.confidence
                                }).execute()
                            except Exception:
                                pass

                    logger.info("duplicates_linked", sku=sku, count=len(dupe_ids) - len(already_matched))
        except Exception as e:
            logger.warning("duplicate_link_failed_nonfatal", error=str(e))

        return {"status": "success", "data": data}

    except Exception as e:
        logger.error("link_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/ignore")
async def ignore_product(request: IgnoreRequest):
    """
    Ignore a product by creating a match entry with NULL opencart_id.
    Also ignores ALL duplicate rows with the same SKU (non-fatal if dedup fails).
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

        # Also ignore ALL duplicates of the same SKU (non-fatal)
        try:
            product = sb.client.table("products").select("sku")\
                .eq("id", request.internal_product_id).limit(1).execute()
            if product.data and product.data[0].get('sku'):
                sku = product.data[0]['sku']
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
                            try:
                                sb.client.table("product_matches").insert({
                                    "internal_product_id": dupe_id,
                                    "opencart_product_id": None,
                                    "match_type": "ignored",
                                    "score": 0
                                }).execute()
                            except Exception:
                                pass  # Skip individual dupe failures

                    logger.info("duplicates_ignored", sku=sku, count=len(dupe_ids) - len(already_matched))
        except Exception as e:
            logger.warning("duplicate_ignore_failed_nonfatal", error=str(e))

        return {"status": "success", "data": data}

    except Exception as e:
        logger.error("ignore_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))

class AutoLinkRequest(BaseModel):
    confidence_threshold: int = 95
    max_products: int = 5000
    dry_run: bool = False

# Background auto-link state
_auto_link_status = {"running": False, "last_result": None}

@router.post("/auto-link")
async def trigger_auto_link(request: AutoLinkRequest):
    """Trigger auto-link in the background. Returns immediately."""
    import asyncio

    if _auto_link_status["running"]:
        return {"status": "already_running", "message": "Auto-link is already running in the background"}

    def _run_sync():
        """Run in a thread so synchronous DB calls don't block the event loop."""
        import asyncio as _aio
        _auto_link_status["running"] = True
        try:
            loop = _aio.new_event_loop()
            result = loop.run_until_complete(auto_link_products(request))
            loop.close()
            _auto_link_status["last_result"] = result
        except Exception as e:
            _auto_link_status["last_result"] = {"status": "failed", "error": str(e)}
        finally:
            _auto_link_status["running"] = False

    import threading
    threading.Thread(target=_run_sync, daemon=True).start()
    return {"status": "started", "message": "Auto-link started in background. Check GET /api/alignment/auto-link-status for progress."}

@router.get("/auto-link-status")
async def get_auto_link_status():
    """Check status of background auto-link."""
    return {
        "running": _auto_link_status["running"],
        "last_result": _auto_link_status["last_result"]
    }

async def auto_link_products(request: AutoLinkRequest):
    """
    Automatically link ALL unmatched products that match OpenCart with high confidence.

    Uses BULK SQL queries instead of per-product lookups to avoid blocking the event loop.
    Pass 1: Single SQL query loads ALL OpenCart SKUs/Models, matches in Python.
    Pass 2: Remaining unmatched go through alignment engine (batched with yields).
    """
    import asyncio
    import re

    sb = get_supabase_connector()
    from src.connectors.opencart import get_opencart_connector

    try:
        oc = get_opencart_connector()

        def _normalize(s):
            if not s:
                return ""
            return re.sub(r'[^a-z0-9]', '', s.lower())

        # ── Step 1: Build set of already-matched internal IDs ──
        matched_ids = set()
        offset = 0
        while True:
            batch = sb.client.table("product_matches")\
                .select("internal_product_id")\
                .range(offset, offset + 999)\
                .execute()
            if not batch.data:
                break
            matched_ids.update(m['internal_product_id'] for m in batch.data)
            if len(batch.data) < 1000:
                break
            offset += 1000

        # ── Step 2: Fetch ALL unmatched products, dedup by SKU ──
        unmatched_by_sku = {}
        offset = 0
        while len(unmatched_by_sku) < request.max_products:
            products = sb.client.table("products")\
                .select("id, sku, product_name, selling_price")\
                .gt("selling_price", 0)\
                .range(offset, offset + 499)\
                .execute()
            if not products.data:
                break
            for p in products.data:
                if p['id'] in matched_ids:
                    continue
                sku = p.get('sku')
                if not sku:
                    continue
                if sku not in unmatched_by_sku:
                    unmatched_by_sku[sku] = []
                unmatched_by_sku[sku].append(p)
            if len(products.data) < 500:
                break
            offset += 500

        if not unmatched_by_sku:
            return {"status": "success", "aligned": 0, "processed": 0,
                    "message": "No unmatched products found"}

        # ── Step 3 (BULK): Load ALL OpenCart products in ONE query (with names) ──
        def _load_oc_products():
            conn = oc._get_connection()
            try:
                with conn.cursor() as cursor:
                    cursor.execute(f"""
                        SELECT p.product_id, p.sku, p.model, pd.name
                        FROM {oc.prefix}product p
                        LEFT JOIN {oc.prefix}product_description pd ON (p.product_id = pd.product_id AND pd.language_id = 1)
                        WHERE p.status = 1
                    """)
                    return cursor.fetchall()
            finally:
                conn.close()

        oc_products = _load_oc_products()

        # Build lookup indexes: normalized SKU/Model -> product_id
        oc_by_sku = {}      # exact sku -> product_id
        oc_by_model = {}    # exact model -> product_id
        oc_by_norm = {}     # normalized (stripped) -> product_id
        oc_by_name = {}     # normalized name -> product_id

        for p in oc_products:
            pid = p['product_id']
            if p.get('sku'):
                oc_by_sku[p['sku']] = pid
                oc_by_norm[_normalize(p['sku'])] = pid
            if p.get('model'):
                oc_by_model[p['model']] = pid
                oc_by_norm[_normalize(p['model'])] = pid
            if p.get('name'):
                name_norm = _normalize(p['name'])
                if name_norm and len(name_norm) >= 6:
                    oc_by_name[name_norm] = pid

        logger.info("auto_link_oc_index_built", oc_products=len(oc_products),
                     unique_norms=len(oc_by_norm), unique_names=len(oc_by_name))

        # ── Pass 1 (Fast): Match by SKU/model in Python using indexes ──
        aligned_count = 0
        processed_count = 0
        pass1_count = 0
        pass1b_count = 0
        pass2_count = 0
        remaining_skus = {}

        for sku, products_list in unmatched_by_sku.items():
            processed_count += 1
            oc_pid = None

            # Try exact SKU
            oc_pid = oc_by_sku.get(sku) or oc_by_model.get(sku)

            # Try normalized
            if not oc_pid:
                sku_norm = _normalize(sku)
                if sku_norm:
                    oc_pid = oc_by_norm.get(sku_norm)

            if oc_pid:
                if not request.dry_run:
                    for p in products_list:
                        try:
                            sb.client.table("product_matches").insert({
                                "internal_product_id": p['id'],
                                "opencart_product_id": oc_pid,
                                "match_type": "auto_sku",
                                "score": 100
                            }).execute()
                            aligned_count += 1
                        except Exception:
                            pass
                    pass1_count += 1
                else:
                    pass1_count += 1
            else:
                remaining_skus[sku] = products_list

        logger.info("auto_link_pass1_done", matched=pass1_count, remaining=len(remaining_skus))

        # ── Pass 1b (Fast): Bulk name matching in Python ──
        # Match by normalized product name — catches 100% name matches instantly
        still_remaining = {}
        for sku, products_list in remaining_skus.items():
            rep = products_list[0]
            product_name = rep.get("product_name", "")
            if not product_name:
                still_remaining[sku] = products_list
                continue

            name_norm = _normalize(product_name)
            oc_pid = oc_by_name.get(name_norm) if name_norm and len(name_norm) >= 6 else None

            if oc_pid:
                if not request.dry_run:
                    for p in products_list:
                        try:
                            sb.client.table("product_matches").insert({
                                "internal_product_id": p['id'],
                                "opencart_product_id": oc_pid,
                                "match_type": "auto_name",
                                "score": 100
                            }).execute()
                            aligned_count += 1
                        except Exception:
                            pass
                    pass1b_count += 1
                else:
                    pass1b_count += 1
            else:
                still_remaining[sku] = products_list

        logger.info("auto_link_pass1b_done", matched=pass1b_count, remaining=len(still_remaining))

        # ── Pass 2 (Deep): Alignment engine for ALL remaining (no cap) ──
        engine = AlignmentEngine()
        pass2_items = list(still_remaining.items())

        for i, (sku, products_list) in enumerate(pass2_items):
            rep = products_list[0]
            supplier_data = {
                "sku": rep.get("sku"),
                "name": rep.get("product_name"),
                "price": rep.get("selling_price")
            }

            try:
                candidates = await engine.find_matches(supplier_data)

                if candidates and candidates[0]['confidence'] >= request.confidence_threshold:
                    best = candidates[0]
                    if not request.dry_run:
                        for p in products_list:
                            try:
                                sb.client.table("product_matches").insert({
                                    "internal_product_id": p['id'],
                                    "opencart_product_id": best['product']['product_id'],
                                    "match_type": best['match_type'],
                                    "score": best['confidence']
                                }).execute()
                                aligned_count += 1
                            except Exception:
                                pass
                        pass2_count += 1
            except Exception as e:
                logger.warning("auto_link_pass2_item_failed", sku=sku, error=str(e))

            # Log progress every 500 products
            if (i + 1) % 500 == 0:
                logger.info("auto_link_pass2_progress", processed=i+1, total=len(pass2_items), matched=pass2_count)

        message = (f"Aligned {aligned_count} products "
                   f"({pass1_count} by SKU, {pass1b_count} by name, {pass2_count} by fuzzy) "
                   f"from {processed_count} unique SKUs scanned.")
        if request.dry_run:
            message = (f"[DRY RUN] Would align {pass1_count} by SKU, {pass1b_count} by name, "
                       f"{pass2_count} by fuzzy from {processed_count} unique SKUs.")

        logger.info("auto_link_complete", aligned=aligned_count, pass1=pass1_count,
                     pass1b=pass1b_count, pass2=pass2_count, processed=processed_count)

        return {
            "status": "success",
            "aligned": aligned_count,
            "processed": processed_count,
            "pass1_sku_matches": pass1_count,
            "pass1b_name_matches": pass1b_count,
            "pass2_fuzzy_matches": pass2_count,
            "message": message
        }

    except Exception as e:
        logger.error("auto_link_failed", error=str(e))
        return {"status": "failed", "error": str(e)}

@router.get("/auto-link")
async def auto_link_products_get():
    """Auto-link products (GET wrapper for cron jobs). Runs in background."""
    return await trigger_auto_link(AutoLinkRequest())

class CreateRequest(BaseModel):
    internal_product_id: str
    name: Optional[str] = None  # Optional name override from frontend
    category_ids: Optional[List[int]] = None

@router.post("/create")
async def create_product(request: CreateRequest):
    """
    Add product to new_products_queue and mark as pending_creation.
    """
    sb = get_supabase_connector()

    try:
        # 1. Fetch product details
        p_response = sb.client.table("products").select("*")\
            .eq("id", request.internal_product_id).limit(1).execute()

        if not p_response.data:
            raise HTTPException(status_code=404, detail="Product not found")

        product = p_response.data[0]
        sku = product.get("sku")

        # --- DUPLICATE GUARD ---
        # Check 1: Already in queue (pending/approved_pending)?
        if sku:
            existing_queue = sb.client.table("new_products_queue")\
                .select("id, status")\
                .eq("sku", sku)\
                .in_("status", ["pending", "approved_pending"])\
                .limit(1)\
                .execute()
            if existing_queue.data:
                logger.info("product_already_in_queue", sku=sku, queue_id=existing_queue.data[0]['id'])
                return {"status": "already_queued", "message": f"SKU {sku} is already in the creation queue"}

        # Check 2: Already exists in OpenCart?
        if sku:
            from src.connectors.opencart import get_opencart_connector
            oc = get_opencart_connector()
            existing_oc = await oc.get_product_by_sku(sku)
            if not existing_oc:
                existing_oc = await oc.get_product_by_model(sku)
            if existing_oc:
                logger.info("product_already_in_opencart", sku=sku, product_id=existing_oc['product_id'])
                return {"status": "already_exists", "message": f"SKU {sku} already exists in OpenCart (ID: {existing_oc['product_id']})"}

        # Check 3: Already matched in product_matches?
        existing_match = sb.client.table("product_matches")\
            .select("id")\
            .eq("internal_product_id", request.internal_product_id)\
            .limit(1)\
            .execute()
        if existing_match.data:
            logger.info("product_already_matched", internal_id=request.internal_product_id)
            return {"status": "already_matched", "message": "This product is already matched or queued"}
        # --- END DUPLICATE GUARD ---

        # 2. Prepare Queue Data
        supplier_name = "Internal-Alignment"
        if product.get("supplier_id"):
            try:
                sup_res = sb.client.table("suppliers").select("name")\
                    .eq("id", product.get("supplier_id")).limit(1).execute()
                if sup_res.data:
                    supplier_name = sup_res.data[0]['name']
            except Exception:
                pass  # Use default supplier name

        # Use name from frontend if provided, else from DB
        final_name = request.name or product.get("product_name") or product.get("name", "Unknown")

        # Round cost price to nearest R10
        raw_price = product.get("cost_price") or product.get("selling_price", 0) or 0
        rounded_price = int(float(raw_price) // 10) * 10

        queue_data = {
            "supplier_name": supplier_name,
            "sku": sku,
            "name": final_name,
            "cost_price": rounded_price,
            "selling_price": product.get("selling_price", 0),
            "stock_level": product.get("total_stock", 0),
            "status": "pending",
            "category_ids": request.category_ids or []
        }

        sb.client.table("new_products_queue").insert(queue_data).execute()

        # 3. Mark as matched so it leaves the unmatched list
        match_data = {
            "internal_product_id": request.internal_product_id,
            "opencart_product_id": None,
            "match_type": "pending_creation",
            "score": 0
        }
        sb.client.table("product_matches").insert(match_data).execute()

        # 4. Also mark duplicates (non-fatal)
        try:
            sku = product.get("sku")
            if sku:
                dupes = sb.client.table("products").select("id").eq("sku", sku).execute()
                dupe_ids = [d['id'] for d in dupes.data if d['id'] != request.internal_product_id]
                for dupe_id in dupe_ids:
                    try:
                        sb.client.table("product_matches").insert({
                            "internal_product_id": dupe_id,
                            "opencart_product_id": None,
                            "match_type": "pending_creation",
                            "score": 0
                        }).execute()
                    except Exception:
                        pass
        except Exception:
            pass

        logger.info("product_queued_for_creation", internal_id=request.internal_product_id, name=final_name)
        return {"status": "success", "data": queue_data}

    except HTTPException:
        raise
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
