import mysql.connector
from datetime import datetime

# Database credentials
db_config = {
    'user': 'audicdmyde_314',
    'password': '4hG4xcGS3tSgX76o5FSv',
    'host': 'dedi159.cpt4.host-h.net',
    'database': 'audicdmyde_db__359',
    'port': 3306
}

def scan_duplicates():
    try:
        print(f"Connecting to database {db_config['host']}...")
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)
        
        print("Connected. Running query for duplicate names...")
        
        # Query to find duplicate names
        # Assuming oc_product_description holds the name and language_id=1 (usually English)
        # We also want to make sure we aren't flagging the same product with different languages as duplicates, 
        # but usually language_id is part of the unique key coupled with product_id.
        # We are looking for DIFFERENT product_ids with the SAME name.
        
        query = """
        SELECT name, COUNT(*) as count, GROUP_CONCAT(product_id) as ids, GROUP_CONCAT(language_id) as langs
        FROM oc_product_description
        WHERE language_id = 1 
        GROUP BY name
        HAVING count > 1
        ORDER BY count DESC;
        """
        
        cursor.execute(query)
        results = cursor.fetchall()
        
        print(f"Found {len(results)} sets of duplicate products based on name.")
        
        if results:
            print(f"{'Count':<5} | {'Name':<50} | {'Product IDs'}")
            print("-" * 80)
            for row in results:
                print(f"{row['count']:<5} | {row['name'][:50]:<50} | {row['ids']}")
        
        cursor.close()
        conn.close()
        
    except mysql.connector.Error as err:
        print(f"Error: {err}")

if __name__ == "__main__":
    scan_duplicates()
