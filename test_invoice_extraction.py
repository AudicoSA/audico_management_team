"""Test the email agent's invoice extraction logic."""
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from agents.email_agent import EmailManagementAgent

# Test cases
test_cases = [
    {
        "name": "Invoice with order number",
        "subject": "Invoice #INV-12345 for Order 28750",
        "body": """
        Dear Customer,
        
        Thank you for your order!
        
        Order Number: 28750
        Invoice Number: INV-12345
        Total Amount: R 5,234.50
        
        Supplier: AudioSure
        
        Please process payment at your earliest convenience.
        """
    },
    {
        "name": "Quote with reference",
        "subject": "Quote QTE-789 - Order #28760",
        "body": """
        Hi there,
        
        Quote Reference: QTE-789
        Order: #28760
        Amount: R12345.00
        
        Regards,
        Pro Audio
        """
    },
    {
        "name": "Simple invoice",
        "subject": "Re: Order 28755",
        "body": """
        Invoice: A-9876
        Total: R 999.99
        """
    }
]

def test_extraction():
    agent = EmailManagementAgent()
    
    print("Testing Invoice Extraction Logic")
    print("=" * 80)
    
    for i, test in enumerate(test_cases, 1):
        print(f"\nTest {i}: {test['name']}")
        print("-" * 80)
        print(f"Subject: {test['subject']}")
        print(f"Body: {test['body'][:100]}...")
        
        # Extract invoice details
        details = agent._extract_invoice_details(test['subject'], test['body'])
        
        print(f"\nExtracted Details:")
        print(f"  Invoice No:    {details.get('invoice_no', 'NOT FOUND')}")
        print(f"  Quote No:      {details.get('quote_no', 'NOT FOUND')}")
        print(f"  Amount:        {details.get('amount', 'NOT FOUND')}")
        print(f"  Supplier Name: {details.get('supplier_name', 'NOT FOUND')}")
        
        # Extract order numbers
        order_nums = agent._extract_order_numbers(test['subject'], test['body'])
        print(f"  Order Numbers: {order_nums if order_nums else 'NOT FOUND'}")
        
        print()

if __name__ == "__main__":
    test_extraction()
