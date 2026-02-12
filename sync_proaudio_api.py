#!/usr/bin/env python3
"""
sync_proaudio_api.py
====================
Fetches ALL products from ProAudio's WooCommerce Store API and syncs to Supabase.

Stock Logic:
- "Ask for Price" (price=0) -> Leave existing price, set stock to 0
- Has actual price -> Set stock to 10

Price Logic:
- Remove 10% from scraped price
- Round to nearest R10 (e.g., R1289 -> R1290, R13462.55 -> R13460)
"""

import os
import time
import math
import html
from typing import Any, Dict, List, Optional
from dotenv import load_dotenv
import requests
from supabase import create_client, Client

# Load environment variables
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ProAudio API Config
BASE_URL = "https://proaudio.co.za/wp-json/wc/store/v1/products"
SUPPLIER_NAME = "Pro Audio"
SUPPLIER_ID = "f608fd75-ae4e-4e91-8132-4f741d01f07d"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"


def round_to_nearest_10(value: float) -> float:
    """Round to nearest R10. E.g., R1289 -> R1290, R13462.55 -> R13460"""
    return round(value / 10) * 10


def apply_discount_and_round(price: float, discount_percent: float = 10) -> float:
    """Apply discount and round to nearest R10."""
    discounted = price * (1 - discount_percent / 100)
    return round_to_nearest_10(discounted)


def fetch_all_products(base_url: str = BASE_URL, per_page: int = 100) -> List[Dict[str, Any]]:
    """Fetch all products from the WooCommerce Store API with pagination."""
    page = 1
    products: List[Dict[str, Any]] = []
    
    print(f"Connecting to ProAudio API: {base_url}")
    
    while True:
        params = {"per_page": per_page, "page": page}
        try:
            response = requests.get(
                base_url, 
                params=params, 
                headers={"User-Agent": USER_AGENT},
                timeout=30
            )
            response.raise_for_status()
            data = response.json()
            
            if not isinstance(data, list) or not data:
                print(f"Reached end of product list at page {page}")
                break
            
            products.extend(data)
            print(f"   Page {page}: Fetched {len(data)} products (Total: {len(products)})")
            page += 1
            time.sleep(0.5)  # Be polite
            
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 400:
                print(f"Reached end of pages (400 Bad Request) at page {page}")
                break
            raise
            
    return products


def parse_price(prices: Dict[str, Any]) -> Optional[float]:
    """Parse price from WooCommerce API format (cents to currency)."""
    price_str = prices.get("price", "0") or "0"
    try:
        price_cents = int(price_str)
    except ValueError:
        return None
    
    if price_cents == 0:
        return None  # "Ask for Price"
    
    currency_minor_unit = int(prices.get("currency_minor_unit", 2))
    return price_cents / (10 ** currency_minor_unit)


def transform_product(product: Dict[str, Any]) -> Dict[str, Any]:
    """Transform API product to database format."""
    prices = product.get("prices", {})
    raw_price = parse_price(prices)
    
    # Stock logic: 
    # - price=0 (Ask for Price) -> stock=0, keep existing price
    # - has price -> stock=10
    if raw_price is None or raw_price == 0:
        stock_level = 0
        # We'll handle keeping existing price during upsert
        final_price = 0  # Marker for "no price available"
        has_real_price = False
    else:
        stock_level = 10
        # Apply 10% discount and round to nearest R10
        final_price = apply_discount_and_round(raw_price, 10)
        has_real_price = True
    
    # Generate SKU if missing
    sku = product.get("sku", "").strip()
    if not sku:
        sku = f"PA-{product.get('slug', product.get('id'))}"
    
    # Get categories
    categories = product.get("categories", [])
    category_str = " > ".join(cat.get("name", "") for cat in categories)
    
    # Get images as list
    images = product.get("images", [])
    image_list = [img.get("src", "") for img in images if img.get("src")]
    
    # Product name - keep proper names like "Audio-Technica AT-VMN40xML"
    # FIX: Decode HTML entities (e.g. &#8243; -> ")
    product_name = html.unescape(product.get("name", "")).strip()
    
    return {
        "supplier_id": SUPPLIER_ID,
        "supplier_sku": sku,
        "product_name": product_name,
        "description": product.get("description", "") or product.get("short_description", "") or "",
        "category_name": category_str,
        "retail_price": final_price,
        "selling_price": final_price,
        "cost_price": 0,
        "total_stock": stock_level,
        "images": image_list,
        "supplier_url": product.get("permalink", ""),
        "sku": sku,
        "active": stock_level > 0,
        "_has_real_price": has_real_price,  # Temp flag for processing
        "_raw_price": raw_price,  # For logging
    }


def sync_to_supabase(products: List[Dict[str, Any]]) -> Dict[str, int]:
    """Sync products to Supabase with special handling for price-less products."""
    stats = {"added": 0, "updated": 0, "errors": 0, "no_price_updated": 0}
    
    # Separate products with and without prices
    products_with_price = [p for p in products if p.get("_has_real_price")]
    products_no_price = [p for p in products if not p.get("_has_real_price")]
    
    print(f"\nProducts with price: {len(products_with_price)}")
    print(f"Products without price (Ask for Price): {len(products_no_price)}")
    
    # Show some price examples
    print("\nPrice conversion examples:")
    for p in products_with_price[:5]:
        raw = p.get("_raw_price", 0)
        final = p.get("retail_price", 0)
        print(f"   {p['product_name'][:40]}: R{raw:,.2f} -> R{final:,.0f} (after 10% off, rounded)")
    
    # Clean up temp flags before upsert
    for p in products:
        p.pop("_has_real_price", None)
        p.pop("_raw_price", None)
    
    # 1. Upsert products WITH prices (full upsert)
    if products_with_price:
        print(f"\nUpserting {len(products_with_price)} products with prices...")
        chunk_size = 100
        for i in range(0, len(products_with_price), chunk_size):
            chunk = products_with_price[i:i + chunk_size]
            try:
                result = supabase.table("products").upsert(
                    chunk,
                    on_conflict="supplier_sku,supplier_id"
                ).execute()
                stats["updated"] += len(chunk)
                print(f"   Chunk {i//chunk_size + 1}: {len(chunk)} products saved")
            except Exception as e:
                print(f"   Error in chunk {i//chunk_size + 1}: {e}")
                stats["errors"] += len(chunk)
    
    # 2. For products WITHOUT prices: Only update stock to 0, keep existing price
    if products_no_price:
        print(f"\nUpdating stock to 0 for {len(products_no_price)} 'Ask for Price' products...")
        batch_count = 0
        for p in products_no_price:
            try:
                # Check if product exists
                existing = supabase.table("products").select("id, retail_price, selling_price").eq(
                    "supplier_sku", p["supplier_sku"]
                ).eq(
                    "supplier_id", p["supplier_id"]
                ).execute()
                
                if existing.data:
                    # Product exists - update only stock fields, keep prices
                    supabase.table("products").update({
                        "total_stock": 0,
                        "active": False
                    }).eq("id", existing.data[0]["id"]).execute()
                    stats["no_price_updated"] += 1
                else:
                    # Product doesn't exist - insert with 0 price (can't preserve what doesn't exist)
                    p["retail_price"] = 0
                    p["selling_price"] = 0
                    supabase.table("products").insert(p).execute()
                    stats["added"] += 1
                
                batch_count += 1
                if batch_count % 50 == 0:
                    print(f"   Processed {batch_count}/{len(products_no_price)} no-price products...")
                    
            except Exception as e:
                print(f"   Error updating {p['supplier_sku']}: {e}")
                stats["errors"] += 1
    
    return stats


def main():
    print("=" * 60)
    print("ProAudio Product Sync via WooCommerce Store API")
    print("=" * 60)
    print("Price logic: -10% then round to nearest R10")
    print("Stock logic: Has price -> 10, No price -> 0")
    print("=" * 60)
    
    # Fetch all products
    raw_products = fetch_all_products()
    print(f"\nTotal products fetched: {len(raw_products)}")
    
    if not raw_products:
        print("No products fetched! Exiting.")
        return
    
    # Transform products
    print("\nTransforming products...")
    transformed = [transform_product(p) for p in raw_products]
    
    # Count stats
    with_price = sum(1 for p in transformed if p.get("_has_real_price", False))
    without_price = len(transformed) - with_price
    print(f"   Products with real price: {with_price}")
    print(f"   Products 'Ask for Price': {without_price}")
    
    # Sync to database
    stats = sync_to_supabase(transformed)
    
    print("\n" + "=" * 60)
    print("SYNC COMPLETE")
    print("=" * 60)
    print(f"   Products with price updated: {stats['updated']}")
    print(f"   'Ask for Price' stock set to 0: {stats['no_price_updated']}")
    print(f"   New products added: {stats['added']}")
    print(f"   Errors: {stats['errors']}")
    print("=" * 60)


if __name__ == "__main__":
    main()
