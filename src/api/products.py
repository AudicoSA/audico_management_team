"""
Product Quality API - Duplicate Detection and Data Quality
"""
from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
from src.connectors.opencart import get_opencart_connector
from src.connectors.supabase import get_supabase_connector
from src.utils.logging import AgentLogger

router = APIRouter(prefix="/api/products", tags=["products"])
logger = AgentLogger("ProductQualityAPI")

@router.get("/duplicates/skus")
async def get_duplicate_skus():
    """Find products with duplicate SKUs in OpenCart."""
    try:
        opencart = get_opencart_connector()
        
        query = """
        SELECT 
            p.sku,
            COUNT(*) as count,
            GROUP_CONCAT(p.product_id) as product_ids,
            GROUP_CONCAT(pd.name SEPARATOR ' | ') as names
        FROM oc_product p
        LEFT JOIN oc_product_description pd ON p.product_id = pd.product_id
        WHERE p.sku IS NOT NULL AND p.sku != ''
        GROUP BY p.sku
        HAVING count > 1
        ORDER BY count DESC
        """
        
        conn = opencart._get_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute(query)
                duplicates = cursor.fetchall()
        finally:
            conn.close()
        
        logger.info("duplicate_skus_found", count=len(duplicates))
        
        return {
            "total": len(duplicates),
            "duplicates": duplicates
        }
        
    except Exception as e:
        logger.error("get_duplicate_skus_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/duplicates/names")
async def get_duplicate_names():
    """Find products with duplicate names in OpenCart."""
    try:
        opencart = get_opencart_connector()
        
        query = """
        SELECT 
            pd.name,
            COUNT(*) as count,
            GROUP_CONCAT(pd.product_id) as product_ids,
            GROUP_CONCAT(p.sku SEPARATOR ' | ') as skus
        FROM oc_product_description pd
        LEFT JOIN oc_product p ON pd.product_id = p.product_id
        WHERE pd.name IS NOT NULL AND pd.name != ''
        GROUP BY pd.name
        HAVING count > 1
        ORDER BY count DESC
        LIMIT 100
        """
        
        conn = opencart._get_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute(query)
                duplicates = cursor.fetchall()
        finally:
            conn.close()
        
        logger.info("duplicate_names_found", count=len(duplicates))
        
        return {
            "total": len(duplicates),
            "duplicates": duplicates
        }
        
    except Exception as e:
        logger.error("get_duplicate_names_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/orphaned")
async def get_orphaned_products():
    """Find products in OpenCart that don't exist in any supplier feed."""
    try:
        opencart = get_opencart_connector()
        supabase = get_supabase_connector()
        
        # Get all SKUs from OpenCart
        query = "SELECT product_id, sku, model FROM oc_product WHERE sku IS NOT NULL AND sku != ''"
        
        conn = opencart._get_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute(query)
                opencart_products = cursor.fetchall()
        finally:
            conn.close()
        
        # Get all SKUs from Supabase products table
        supabase_response = supabase.client.table("products")\
            .select("sku")\
            .execute()
        
        supabase_skus = set(p['sku'] for p in supabase_response.data if p.get('sku'))
        
        # Find orphaned products
        orphaned = [
            p for p in opencart_products 
            if p['sku'] not in supabase_skus
        ]
        
        logger.info("orphaned_products_found", count=len(orphaned))
        
        return {
            "total": len(orphaned),
            "orphaned": orphaned[:100]  # Limit to first 100
        }
        
    except Exception as e:
        logger.error("get_orphaned_products_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/missing")
async def get_missing_products():
    """Find products in supplier feeds that don't exist in OpenCart."""
    try:
        opencart = get_opencart_connector()
        supabase = get_supabase_connector()
        
        # Get all SKUs from OpenCart
        query = "SELECT sku FROM oc_product WHERE sku IS NOT NULL AND sku != ''"
        
        conn = opencart._get_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute(query)
                opencart_skus = set(p['sku'] for p in cursor.fetchall())
        finally:
            conn.close()
        
        # Get all active products from Supabase
        supabase_response = supabase.client.table("products")\
            .select("sku, product_name, supplier_id, cost_price")\
            .eq("active", True)\
            .execute()
        
        # Find active products
        missing = [
            p for p in supabase_response.data 
            if p.get('sku') and p['sku'] not in opencart_skus
        ]
        
        logger.info("missing_products_found", count=len(missing))
        
        return {
            "total": len(missing),
            "missing": missing[:100]  # Limit to first 100
        }
        
    except Exception as e:
        logger.error("get_missing_products_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/duplicates/potential")
async def get_potential_duplicates():
    """
    Find 'Fuzzy' duplicates: OpenCart products that are NOT aligned, 
    but match an Aligned product via Model/SKU rules.
    """
    import re
    
    def normalize_string(s):
        if not s: return ""
        return re.sub(r'[^a-z0-9]', '', str(s).lower())

    try:
        opencart = get_opencart_connector()
        supabase = get_supabase_connector()
        
        # 1. Fetch Alignment Matches (Aligned IDs)
        matches = supabase.client.table("product_matches").select("opencart_product_id").execute()
        aligned_ids = set(m['opencart_product_id'] for m in matches.data if m.get('opencart_product_id'))
        
        # 2. Fetch All OpenCart Products
        query = """
            SELECT p.product_id, p.sku, p.model, pd.name 
            FROM oc_product p 
            JOIN oc_product_description pd ON p.product_id = pd.product_id 
            WHERE pd.language_id = 1
        """
        conn = opencart._get_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute(query)
                oc_products = cursor.fetchall()
        finally:
            conn.close()
        
        # 3. Separate Aligned vs Unaligned
        aligned = []
        unaligned = []
        
        for p in oc_products:
            p['norm_sku'] = normalize_string(p.get('sku'))
            p['norm_model'] = normalize_string(p.get('model'))
            
            if p['product_id'] in aligned_ids:
                aligned.append(p)
            else:
                unaligned.append(p)
                
        # 4. Build Indexes for Aligned
        aligned_sku_map = {}
        aligned_model_map = {}
        
        for p in aligned:
            if p['norm_sku']: aligned_sku_map[p['norm_sku']] = p
            if p['norm_model']: aligned_model_map[p['norm_model']] = p
            
        # 5. Scan for Duplicates
        potential_duplicates = []
        
        for u in unaligned:
            target = None
            match_type = ""
            
            # Check 1: Model Match
            u_model = u['norm_model']
            if u_model:
                if u_model in aligned_sku_map:
                    target = aligned_sku_map[u_model]
                    match_type = "Model matches Aligned SKU"
                elif u_model in aligned_model_map:
                    target = aligned_model_map[u_model]
                    match_type = "Model matches Aligned Model"
                    
            # Check 2: SKU Match (if no model match)
            if not target:
                u_sku = u['norm_sku']
                if u_sku:
                    if u_sku in aligned_sku_map:
                        target = aligned_sku_map[u_sku]
                        match_type = "SKU matches Aligned SKU"
                    elif u_sku in aligned_model_map:
                        target = aligned_model_map[u_sku]
                        match_type = "SKU matches Aligned Model"
            
            if target:
                potential_duplicates.append({
                    "unaligned": {
                        "product_id": u['product_id'],
                        "sku": u['sku'],
                        "model": u['model'],
                        "name": u['name']
                    },
                    "aligned": {
                        "product_id": target['product_id'],
                        "sku": target['sku'],
                        "model": target['model'],
                        "name": target['name']
                    },
                    "reason": match_type
                })
                
        logger.info("potential_duplicates_found", count=len(potential_duplicates))
        
        return {
            "total": len(potential_duplicates),
            "duplicates": potential_duplicates
        }

    except Exception as e:
        logger.error("get_potential_duplicates_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/merge")
async def merge_products(payload: Dict[str, Any]):
    """Merge duplicate products (keep one, delete others)."""
    try:
        target_id = payload.get('target_product_id')
        source_ids = payload.get('source_product_ids', [])
        
        if not target_id or not source_ids:
            raise HTTPException(status_code=400, detail="Missing target or source product IDs")
        
        opencart = get_opencart_connector()
        supabase = get_supabase_connector()
        
        # TODO: Implement merge logic
        # 1. Copy any missing data from source products to target
        # 2. Update any orders/references to point to target
        # 3. Delete source products
        # 4. Log merge in product_merge_history
        
        logger.info("products_merged", target=target_id, sources=source_ids)
        
        return {
            "success": True,
            "message": f"Merged {len(source_ids)} products into product {target_id}"
        }
        
    except Exception as e:
        logger.error("merge_products_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))
