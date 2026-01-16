/**
 * Debug script to understand why only 7 links were found
 */

import 'dotenv/config';
import { chromium } from 'playwright';

async function debugKlipschLinks() {
  console.log('🔍 Debugging Klipsch product links...\n');

  const browser = await chromium.launch({
    headless: false, // Show browser to see what's happening
    timeout: 30000,
  });

  const page = await browser.newPage({
    userAgent: 'AudicoMCPScraper/1.0',
    viewport: { width: 1280, height: 720 },
  });

  const url = 'https://www.planetworld.co.za/products/browse/?categoryids=690&manufacturerids=99';
  console.log(`📄 Loading: ${url}\n`);

  await page.goto(url, {
    waitUntil: 'domcontentloaded',
    timeout: 20000,
  });

  await page.waitForTimeout(2000);

  // Check current link patterns
  console.log('🔗 Checking all link patterns on page...\n');

  const allLinks = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href]'));
    const productLinks = links.filter((a: any) =>
      a.href && a.href.includes('/products/')
    );

    const patterns: Record<string, string[]> = {};

    productLinks.forEach((link: any) => {
      const href = link.href;

      // Categorize by pattern
      if (/\/products\/[^\/]+$/.test(href)) {
        patterns['Detail Pages (old filter)'] = patterns['Detail Pages (old filter)'] || [];
        patterns['Detail Pages (old filter)'].push(href);
      }

      if (/\/products\/browse\//.test(href)) {
        patterns['Browse Pages'] = patterns['Browse Pages'] || [];
        patterns['Browse Pages'].push(href);
      }

      if (/productid=/.test(href)) {
        patterns['Product ID Pages'] = patterns['Product ID Pages'] || [];
        patterns['Product ID Pages'].push(href);
      }

      if (href.includes('/products/') && !href.includes('browse') && !href.includes('productid')) {
        patterns['Other Product Links'] = patterns['Other Product Links'] || [];
        patterns['Other Product Links'].push(href);
      }
    });

    return patterns;
  });

  console.log('Link patterns found:\n');
  for (const [pattern, links] of Object.entries(allLinks)) {
    const uniqueLinks = [...new Set(links)];
    console.log(`${pattern}: ${uniqueLinks.length} unique links`);
    if (uniqueLinks.length > 0) {
      console.log(`  Examples:`);
      uniqueLinks.slice(0, 3).forEach(link => console.log(`    - ${link}`));
    }
    console.log('');
  }

  // Try clicking Load More and see what changes
  console.log('🔄 Clicking Load More once...\n');

  try {
    const loadMoreBtn = page.locator('text="Load More"').first();
    if (await loadMoreBtn.isVisible({ timeout: 2000 })) {
      await loadMoreBtn.click();
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(1000);

      const linksAfter = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href*="/products/"]'));
        return links.length;
      });

      console.log(`✅ After Load More: ${linksAfter} product links total\n`);
    }
  } catch (e) {
    console.log('⚠️  Load More button not found\n');
  }

  // Check the actual product grid structure
  console.log('🎯 Checking product grid structure...\n');

  const gridInfo = await page.evaluate(() => {
    // Common e-commerce selectors
    const selectors = [
      '.product-item',
      '.product-card',
      '.product',
      '[data-product]',
      '[class*="product"]',
      'article',
      '.item',
    ];

    const results: Record<string, number> = {};

    selectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        results[selector] = elements.length;
      }
    });

    return results;
  });

  console.log('Product grid elements found:');
  for (const [selector, count] of Object.entries(gridInfo)) {
    console.log(`  ${selector}: ${count} elements`);
  }

  console.log('\n✅ Debug complete. Press Ctrl+C to close browser when ready.');

  // Keep browser open for inspection
  await page.waitForTimeout(60000);
  await browser.close();
}

debugKlipschLinks().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
