import asyncio
import logging
from src.scheduler.supplier_scanner import SupplierScanner
from src.scheduler.jobs import setup_scheduler, scheduler

# Configure logging to console
logging.basicConfig(level=logging.INFO)

async def test_flow():
    print("\n--- Testing Supplier Scanner Service ---")
    service = SupplierScanner()
    
    # Test Scanner Registration
    print(f"Registered Scanners: {list(service.scanners.keys())}")
    
    # Test Run Scan (Mock Esquire)
    print("\nRunning Esquire Scan (Mock)...")
    result = await service.run_scan("Esquire")
    print(f"Scan Result: {result}")
    
    # Note: The result might show failed items because we don't have real DB entries for the mock SKUs
    # But as long as it runs and tries to process, the scanner logic is working.
    
    print("\n--- Testing Scheduler Jobs ---")
    setup_scheduler()
    jobs = scheduler.get_jobs()
    print(f"Scheduled Jobs: {[job.id for job in jobs]}")
    
    if "scan_esquire" in [job.id for job in jobs] and "scan_rectron" in [job.id for job in jobs]:
        print("SUCCESS: Jobs scheduled correctly.")
    else:
        print("FAILURE: Jobs missing.")

if __name__ == "__main__":
    asyncio.run(test_flow())
