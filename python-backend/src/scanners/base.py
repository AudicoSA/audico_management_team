from typing import List, Dict, Any, Protocol

class ScannerProtocol(Protocol):
    """Protocol that all supplier scanners must implement."""
    
    async def run_scan(self) -> List[Dict[str, Any]]:
        """
        Run the scan and return a list of product data.
        
        Returns:
            List of dictionaries containing:
            - sku: Supplier SKU (required)
            - stock: Current stock level (int)
            - price: Current price (float)
            - name: Product name (optional)
        """
        ...
