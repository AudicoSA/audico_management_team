// Quick inspection of the Klipsch page structure
const { chromium } = require('playwright');

async function inspectPage() {
  console.log('🔍 Inspecting Klipsch page structure...\n');

  const browser = await chromium.launch({
    headless: false, // Show browser
    timeout: 30000,
  });

  const page = await browser.newPage();
  const url = 'https://www.planetworld.co.za/products/browse/?categoryids=690&manufacturerids=99';

  console.log(`📄 Loading: ${url}\n`);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // Check what the page actually shows
  const pageInfo = await page.evaluate(() => {
    const title = document.title;
    const h1 = document.querySelector('h1')?.textContent;

    // Find all product-like elements
    const productCards = document.querySelectorAll('[class*="product"], [data-product], .item, article');

    // Find all links
    const allLinks = Array.from(document.querySelectorAll('a[href*="/products/"]'));
    const linkTypes = {};

    allLinks.forEach(link => {
      const href = link.href;
      const text = link.textContent?.trim();

      if (text && text.length > 0 && text.length < 100) {
        linkTypes[text] = href;
      }
    });

    return {
      title,
      h1,
      productCardCount: productCards.length,
      linkTypes,
    };
  });

  console.log('Page Analysis:');
  console.log('  Title:', pageInfo.title);
  console.log('  H1:', pageInfo.h1);
  console.log('  Product-like elements:', pageInfo.productCardCount);
  console.log('\nLinks found (first 10):');

  Object.entries(pageInfo.linkTypes).slice(0, 10).forEach(([text, href]) => {
    console.log(`  "${text}" → ${href}`);
  });

  console.log('\n⏸️  Browser will stay open for 60 seconds for manual inspection...');
  console.log('   Check if these are categories or actual products!');

  await page.waitForTimeout(60000);
  await browser.close();
}

inspectPage().catch(console.error);
