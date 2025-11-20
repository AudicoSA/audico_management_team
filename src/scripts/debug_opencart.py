

import asyncio
import httpx
from src.utils.config import get_config

async def debug_opencart():
    config = get_config()
    base_url = config.opencart_base_url
    username = config.opencart_admin_username or config.opencart_client_id
    key = config.opencart_admin_password or config.opencart_client_secret
    
    print(f"Testing OpenCart API at: {base_url}")
    print(f"Username: {username}")
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json"
    }
    
    async with httpx.AsyncClient(timeout=30.0, headers=headers) as client:
        # 1. Check Common Endpoint (Dashboard) - usually requires login but lets see response
        print("\n--- 1. Checking Dashboard Endpoint (Pre-Login) ---")
        try:
            resp = await client.get(f"{base_url}/index.php?route=api/common/dashboard")
            print(f"Status: {resp.status_code}")
            print(f"Headers: {dict(resp.headers)}")
            print(f"Cookies: {dict(client.cookies)}")
            print(f"Response: {resp.text[:500]}")
        except Exception as e:
            print(f"Error: {e}")

        # 2. Login with Form Data
        print("\n--- 2. Login Attempt (Form Data) ---")
        try:
            # OpenCart 3 often needs the session cookie from the first request
            url = f"{base_url}/index.php?route=api/login"
            data = {"username": username, "key": key}
            
            resp = await client.post(url, data=data)
            print(f"Status: {resp.status_code}")
            print(f"Cookies: {dict(client.cookies)}")
            print(f"Response: {resp.text[:500]}")
            
            if "api_token" in resp.text or "token" in resp.text:
                print(">>> SUCCESS: Token found in response!")
            else:
                print(">>> FAILURE: No token in response.")
                
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(debug_opencart())

