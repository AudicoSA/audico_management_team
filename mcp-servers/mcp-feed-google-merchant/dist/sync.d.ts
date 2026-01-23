/**
 * Ongoing sync script for Google Merchant Feed
 *
 * USAGE: npm run sync
 *
 * PURPOSE: Catches new products added manually to OpenCart
 * - Skips products managed by real suppliers
 * - Only syncs Manual Upload products
 */
import 'dotenv/config';
