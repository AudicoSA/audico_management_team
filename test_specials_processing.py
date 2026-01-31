
import pandas as pd
import asyncio
from process_specials_emails import process_excel_attachment

def create_mock_excel(filename="mock_specials.xlsx"):
    data = {
        "Product Code": ["SPK-001", "AMP-500", "SUB-123"],
        "Description": ["High End Speaker", "Power Amplifier 500W", "Subwoofer 12 inch"],
        "Normal Dealer Price": [1000, 5000, 3000],
        "Promo Dealer Price": [800, 4000, 2500],
        "Retail Price": [1500, 7500, 4500]
    }
    df = pd.DataFrame(data)
    df.to_excel(filename, index=False)
    print(f"Created {filename}")
    return filename

def test_processing():
    filename = create_mock_excel()
    
    with open(filename, "rb") as f:
         data = f.read()
         
    print(f"\nTesting processing of {filename}...")
    deals = process_excel_attachment(data, filename)
    
    print(f"\nExtracted {len(deals)} deals:")
    for d in deals:
        print(d)
        
    assert len(deals) == 3
    assert deals[0]['sku'] == "SPK-001"
    assert float(deals[0]['price']) == 800.0  # Should pick Promo Dealer Price

if __name__ == "__main__":
    test_processing()
