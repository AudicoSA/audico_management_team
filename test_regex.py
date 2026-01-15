import re

def extract_order_numbers(subject: str, body: str) -> list[str]:
    combined_text = f"{subject} {body}"
    patterns = [
        r"#(\d{4,6})",  # #12345
        r"Order\s+#?(\d{4,6})",  # Order 12345 or Order #12345
        r"order\s+number\s*:?\s*#?(\d{4,6})",  # order number: 12345
    ]

    order_numbers = []
    for pattern in patterns:
        matches = re.findall(pattern, combined_text, re.IGNORECASE)
        order_numbers.extend(matches)

    return list(set(order_numbers))

subject = "FW: 900145"
body = "Please see attached."
print(f"Subject: {subject}")
print(f"Extracted: {extract_order_numbers(subject, body)}")
