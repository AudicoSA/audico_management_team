import re

def extract_order_numbers(subject: str, body: str) -> list[str]:
    # Original patterns
    patterns = [
        r"#(\d{4,6})",
        r"Order\s+#?(\d{4,6})",
        r"order\s+number\s*:?\s*#?(\d{4,6})",
    ]
    
    # New strict pattern for Subject only (Standalone 6 digit number)
    # Matches: "900145", "FW: 900145", "Re: 900145", "Order 900145"
    # But relies on boundaries.
    subject_pattern = r"(?:^|\s|:|#)(\d{6})(?:$|\s)" 

    order_numbers = []
    
    # scan subject specifically with looser pattern
    matches = re.findall(subject_pattern, subject, re.IGNORECASE)
    order_numbers.extend(matches)

    combined_text = f"{subject} {body}"
    for pattern in patterns:
        matches = re.findall(pattern, combined_text, re.IGNORECASE)
        order_numbers.extend(matches)

    return list(set(order_numbers))

tests = [
    ("FW: 900145", "Body"),
    ("900145", "Body"),
    ("Order 900145", "Body"),
    ("Subject with 123456 inside", "Body"),
    ("Phone 0113925639", "Body"), # Should NOT match (10 digits)
    ("Price 1234.56", "Body"), # Should NOT match
]

for s, b in tests:
    print(f"'{s}': {extract_order_numbers(s, b)}")
