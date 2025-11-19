"""Test if supplier emails are being detected."""
import asyncio
from src.models.llm_client import classify_email

async def test():
    print("Testing supplier email detection...\n")

    # Test 1: Email from Nology (supplier)
    print("Test 1: Email from Nology supplier")
    result = await classify_email(
        email_body="Hi Lucky, do you have stock on the BH76 headsets?",
        subject="RE: Yealink BH76 Headset"
    )
    print(f"Category: {result['category']}")
    print(f"Confidence: {result['confidence']}")
    print(f"Reasoning: {result['reasoning']}")
    print()

    # Test 2: Email from Homemation (supplier)
    print("Test 2: Email from Homemation supplier")
    result = await classify_email(
        email_body="Your order ORD158100-02 has been confirmed and will ship today.",
        subject="Order Confirmed: ORD158100-02"
    )
    print(f"Category: {result['category']}")
    print(f"Confidence: {result['confidence']}")
    print(f"Reasoning: {result['reasoning']}")
    print()

    # Test 3: Customer email
    print("Test 3: Customer email")
    result = await classify_email(
        email_body="Hi, where is my order #12345? I haven't received it yet.",
        subject="Order status inquiry"
    )
    print(f"Category: {result['category']}")
    print(f"Confidence: {result['confidence']}")
    print(f"Reasoning: {result['reasoning']}")
    print()

if __name__ == "__main__":
    asyncio.run(test())
