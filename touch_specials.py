
import asyncio
from src.connectors.opencart import get_opencart_connector

async def touch_products_with_specials():
    oc = get_opencart_connector()
    
    print("Touching products with active specials to clear cache...")
    
    connection = oc._get_connection()
    try:
        with connection.cursor() as cursor:
            # Select products that have a special active today
            sql = f"""
                SELECT DISTINCT ps.product_id, pd.name 
                FROM {oc.prefix}product_special ps
                JOIN {oc.prefix}product_description pd ON (ps.product_id = pd.product_id)
                WHERE ps.date_end >= CURDATE() OR ps.date_end = '0000-00-00'
            """
            cursor.execute(sql)
            products = cursor.fetchall()
            
            print(f"Found {len(products)} active specials.")
            
            count = 0
            for p in products:
                # Update date_modified
                update_sql = f"UPDATE {oc.prefix}product SET date_modified = NOW() WHERE product_id = %s"
                cursor.execute(update_sql, (p['product_id'],))
                count += 1
                # print(f"Touched: {p['name']}")
            
            connection.commit()
            print(f"✅ Successfully updated {count} products. Check frontend now.")
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        connection.close()

if __name__ == "__main__":
    asyncio.run(touch_products_with_specials())
