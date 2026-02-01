from typing import List, Dict, Any
import asyncio
import random

class RectronScanner:
    """Scanner for Rectron supplier."""

    async def run_scan(self) -> List[Dict[str, Any]]:
        """
        Mock implementation of Rectron scan.
        """
        # Simulating IO delay
        await asyncio.sleep(1)
        
        # Return some mock data
        return [
            {"sku": "REC-101", "stock": random.randint(0, 100), "price": 1200.00, "name": "Rectron Item A"},
            {"sku": "REC-102", "stock": random.randint(0, 5), "price": 500.00, "name": "Rectron Item B"},
        ]
