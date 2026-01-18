# PlanetWorld Scraper Debugging Guide

## Overview
We are currently successfully scraping the initial 16 products from PlanetWorld (`planetworld.co.za`), but we are failing to load or scrape the remaining inventory (expected ~500+ products). The system is currently relying on a "Safety Net" fallback that captures the initial 16 products via intercepted network API calls to prevent the sync from failing completely.

## Key Files
*   **Main Logic**: [`mcp-servers/mcp-feed-planetworld/src/index.ts`](mcp-servers/mcp-feed-planetworld/src/index.ts)
    *   `syncProducts()`: Orchestrates the scraping flow.
    *   `infiniteScroll()`: Implemention of the scrolling logic to trigger lazy-loading.
    *   `collectProductLinks()`: Scrapes product URLs from the main listing page.
    *   `scrapeProductDetails()`: Visits each product URL to extract Name, SKU, Price, etc.
*   **Deployment**: [`Dockerfile`](Dockerfile)
    *   Uses official image: `mcr.microsoft.com/playwright:v1.42.1-jammy`.

## The Problems

### 1. Infinite Scroll / Product Loading
*   **Behavior**: The website uses infinite scrolling.
*   **Issue**: Our `infiniteScroll` function (lines ~500+) attempts to scroll to the bottom to trigger new items. However, in the headless Docker environment, it appears that **no new products are loaded** beyond the initial 16-20.
*   **Suspected Cause**:
    *   Scrolling might be too fast or "jumpy" for the intersection observer.
    *   Headless browser detection might be throttling requests.
    *   Network conditions in the container might be causing timeouts for the AJAX calls that fetch new products.

### 2. DOM Selector Reliability
*   **Function**: `scrapeProductDetails` (lines ~760+)
*   **Issue**: Even when product links `are` found, the scraper often returns `0` verified products.
*   **Suspected Cause**:
    *   The CSS selectors for `Name` (h1, .product-name), `SKU` (.sku, text match), and `Price` (.price, .amount) might fail on specific product pages or layout variations.
    *   We recently added a "Safety Net" (lines ~300-330 in `index.ts`) that reverts to using the API method if DOM scraping yields 0 products.

## Debugging Instructions
To debug this locally:

1.  **Environment**: Ensure you have a `.env` file in the root with `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, etc.
2.  **Run with Visual Head**: Modify `index.ts` to set `headless: false` in `playwright.launch()`.
3.  **Command**:
    ```bash
    npx ts-node mcp-servers/mcp-feed-planetworld/src/sync.ts --limit 50 --dry-run
    ```
4.  **Goal**:
    *   Get `collectProductLinks` to return > 16 links.
    *   Get `scrapeProductDetails` to successfully extract Name/SKU/Price for those links.
