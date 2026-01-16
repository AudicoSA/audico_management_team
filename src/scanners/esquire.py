from typing import List, Dict, Any
import asyncio
import random

class EsquireScanner:
    """Scanner for Esquire supplier."""

    async def run_scan(self) -> List[Dict[str, Any]]:
        """
        Mock implementation of Esquire scan.
        In reality, this would fetch a CSV/XML or scrape the site.
        """
        # Simulating IO delay
        await asyncio.sleep(1)
        
        # Return some mock data
        return [
            {"sku": "ESQ-001", "stock": random.randint(0, 50), "price": 100.00, "name": "Test Product 1"},
            {"sku": "ESQ-002", "stock": random.randint(0, 50), "price": 250.50, "name": "Test Product 2"},
            {"sku": "ESQ-003", "stock": 0, "price": 50.00, "name": "Test Product 3"},
        ]
