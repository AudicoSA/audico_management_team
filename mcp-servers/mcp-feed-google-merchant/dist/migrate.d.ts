/**
 * ONE-TIME migration script for Google Merchant Feed
 *
 * USAGE: npm run migrate
 *
 * PURPOSE: Import all 7,000+ existing OpenCart products into Supabase
 * - Run this ONCE to populate Supabase with existing store products
 * - After this, use npm run sync for ongoing updates
 *
 * WARNING: This will import ALL products from the feed
 */
import 'dotenv/config';
