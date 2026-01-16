/**
 * OpenCart Push MCP Server
 * Pushes Supabase products to OpenCart with AI-powered deduplication
 */

import Anthropic from '@anthropic-ai/sdk';
import axios from 'axios';
import {
  SupabaseService,
  logger,
  logSync,
  UnifiedProduct,
} from '@audico/shared';
import { loadOpenCartCache } from './load-excel-cache';

// ============================================
// OPENCART TYPES
// ============================================

export interface OpenCartCredentials {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  adminUsername: string;
  adminPassword: string;
}

export interface OpenCartProduct {
  product_id?: string;
  model: string;
  sku: string;
  price: string;
  quantity: string;
  status: '0' | '1';
  manufacturer_id?: string;
  tax_class_id?: string;
  weight?: string;
  weight_class_id?: number;
  length?: string;
  width?: string;
  height?: string;
  length_class_id?: number;
  subtract?: number;
  minimum?: number;
  sort_order?: number;
  date_available?: string;
  stock_status_id?: number;
  shipping?: number;
  product_store: number[];
  product_category: number[];
  product_description: Array<{
    language_id: string | number;
    name: string;
    description?: string;
    meta_title?: string;
    meta_description?: string;
    meta_keyword?: string;
    tag?: string;
  }>;
}

export interface ProductMatch {
  matched: boolean;
  confidence: number;
  opencart_product_id?: string;
  match_type: 'exact_sku' | 'model_brand' | 'ai_semantic' | 'fuzzy_hybrid' | 'none';
  reasoning?: string;
}

export interface PushResult {
  success: boolean;
  product_id: string;
  product_name: string;
  action: 'created' | 'updated' | 'skipped' | 'failed';
  opencart_id?: string;
  match_info?: ProductMatch;
  error?: string;
}

export interface PushSessionResult {
  success: boolean;
  session_id: string;
  products_created: number;
  products_updated: number;
  products_skipped: number;
  products_failed: number;
  results: PushResult[];
  duration_seconds: number;
}

export interface PushOptions {
  limit?: number;
  dryRun?: boolean;
  sessionName?: string;
  skipMatching?: boolean; // Force create all as new
  brand?: string; // Filter by brand name
  supplierId?: string; // Filter by supplier_id
}

// ============================================
// OPENCART PUSH MCP SERVER
// ============================================

export class OpenCartPushServer {
  private supabase: SupabaseService;
  private anthropic: Anthropic;
  private config: OpenCartCredentials;
  private bearer: string = '';

  // OpenCart existing products cache (for matching)
  private openCartProductsCache: Map<string, any> = new Map();

  constructor() {
    this.supabase = new SupabaseService();
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    });

    this.config = {
      baseUrl: process.env.OPENCART_BASE_URL || 'https://www.audicoonline.co.za',
      clientId: process.env.OPENCART_CLIENT_ID || 'demo_oauth_client',
      clientSecret: process.env.OPENCART_CLIENT_SECRET || 'demo_oauth_secret',
      adminUsername: process.env.OPENCART_ADMIN_USERNAME || 'admin',
      adminPassword: process.env.OPENCART_ADMIN_PASSWORD || '',
    };
  }

  // ============================================
  // OPENCART API METHODS
  // ============================================

  private ocRoute(route: string): string {
    const sep = this.config.baseUrl.endsWith('/') ? '' : '/';
    return `${this.config.baseUrl}${sep}index.php?route=${route}`;
  }

  private async jsonFetch(url: string, init: RequestInit = {}) {
    try {
      const res = await axios({
        url,
        method: init.method as any || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(init.headers || {}) as Record<string, string>,
        } as any,
        data: init.body,
        validateStatus: () => true, // Don't throw on any status
      });

      return {
        ok: res.status >= 200 && res.status < 300,
        status: res.status,
        json: res.data,
      };
    } catch (error: any) {
      logger.error(`❌ HTTP request failed to ${url}: ${error.message}`);
      if (error.code) logger.error(`   Error code: ${error.code}`);
      if (error.cause) logger.error(`   Cause: ${error.cause}`);
      throw error;
    }
  }

  private async getBearerToken(): Promise<string> {
    const basic = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');
    const url = this.ocRoute('rest/admin_security/gettoken&grant_type=client_credentials');

    const { ok, status, json } = await this.jsonFetch(url, {
      method: 'POST',
      headers: { Authorization: `Basic ${basic}` },
    });

    if (!ok) throw new Error(`Token failed (${status}): ${JSON.stringify(json)}`);

    const token = json?.data?.access_token || json?.access_token;
    if (!token) throw new Error('Missing access_token in response');

    return token;
  }

  private async adminLogin(bearer: string): Promise<void> {
    const url = this.ocRoute('rest/admin_security/login');

    const { ok, status, json } = await this.jsonFetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${bearer}` },
      body: JSON.stringify({
        username: this.config.adminUsername,
        password: this.config.adminPassword,
      }),
    });

    if (!ok || !json?.success) {
      throw new Error(`Admin login failed (${status}): ${JSON.stringify(json)}`);
    }
  }

  private async addProduct(product: OpenCartProduct): Promise<any> {
    const url = this.ocRoute('rest/product_admin/products');

    const { ok, status, json } = await this.jsonFetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.bearer}` },
      body: JSON.stringify(product),
    });

    if (!ok || !json?.success) {
      throw new Error(`Add product failed (${status}): ${JSON.stringify(json)}`);
    }

    return json;
  }

  private async updateProduct(productId: string, updates: Partial<OpenCartProduct>): Promise<any> {
    // Note: OpenCart REST API update functionality needs investigation
    // For now, we skip updates to avoid creating duplicates
    throw new Error('Update not supported - will skip matched products');
  }

  private async checkProductExistsBySku(sku: string): Promise<{ exists: boolean; product_id?: string }> {
    try {
      // Check Supabase tracking table (fast and reliable)
      logger.info(`   🔍 Checking SKU "${sku}" in Supabase tracking table...`);
      const { data, error } = await this.supabase
        .getClient()
        .from('pushed_to_opencart')
        .select('opencart_product_id')
        .eq('sku', sku.trim())
        .maybeSingle();

      if (error) {
        logger.warn(`⚠️  Error checking SKU in Supabase: ${error.message}`);
        return { exists: false };
      }

      if (data) {
        logger.info(`   ✅ SKU found in tracking table - SKIPPING`);
        return { exists: true, product_id: data.opencart_product_id };
      }

      logger.info(`   ➕ SKU not found in tracking table - will create`);
      return { exists: false };
    } catch (error: any) {
      logger.warn(`⚠️  Error checking SKU ${sku}: ${error.message}`);
      return { exists: false };
    }
  }

  private async markProductAsPushed(sku: string, opencart_product_id?: string): Promise<void> {
    try {
      // Normalize SKU for storage (lowercase, remove spaces/dashes/underscores)
      const normalizedSku = sku.trim().toLowerCase().replace(/[\s\-_]/g, '');

      const { error } = await this.supabase
        .getClient()
        .from('pushed_to_opencart')
        .upsert({
          sku: normalizedSku, // Store normalized SKU for consistent matching
          opencart_product_id: opencart_product_id || null,
          pushed_at: new Date().toISOString(),
        }, {
          onConflict: 'sku'
        });

      if (error) {
        logger.error(`❌ Failed to mark SKU as pushed: ${error.message}`);
      } else {
        logger.info(`   ✅ Marked SKU "${sku}" (normalized: "${normalizedSku}") as pushed in tracking table`);
      }
    } catch (error: any) {
      logger.error(`❌  Error marking product as pushed: ${error.message}`);
    }
  }

  private async fetchOpenCartProducts(): Promise<any[]> {
    try {
      logger.info('📥 Fetching existing OpenCart products (may take a while)...');

      const allProducts: any[] = [];
      let page = 1;
      const limit = 100; // OpenCart seems to cap at 100 per request

      // Fetch all pages
      while (true) {
        const start = (page - 1) * limit;
        const url = `${this.config.baseUrl}/api/rest_admin/products?start=${start}&limit=${limit}`;

        const response = await axios({
          url,
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.bearer}`,
            Accept: 'application/json',
          },
          validateStatus: () => true,
        });

        if (response.status !== 200) {
          logger.warn(`Failed to fetch page ${page}, stopping at ${allProducts.length} products`);
          break;
        }

        const json = response.data;
        if (!json?.success || !Array.isArray(json?.data)) {
          logger.warn(`Invalid response on page ${page}, stopping`);
          break;
        }

        const pageProducts = json.data;
        if (pageProducts.length === 0) {
          break; // No more products
        }

        allProducts.push(...pageProducts);
        logger.info(`   Page ${page}: +${pageProducts.length} products (total: ${allProducts.length})`);

        // Stop if we got fewer products than the limit (last page)
        if (pageProducts.length < limit) {
          break;
        }

        page++;

        // Rate limiting between pages
        await new Promise((resolve) => setTimeout(resolve, 300));

        // Safety: stop after 50 pages (5000 products)
        if (page > 50) {
          logger.warn('Reached 50 page limit, stopping fetch');
          break;
        }
      }

      logger.info(`✅ Fetched ${allProducts.length} existing OpenCart products across ${page} pages`);

      return allProducts;
    } catch (error: any) {
      logger.error(`❌ Failed to fetch OpenCart products: ${error.message}`);
      return [];
    }
  }

  // ============================================
  // AUTHENTICATION
  // ============================================

  async testConnection(): Promise<boolean> {
    try {
      logger.info('🔌 Testing OpenCart API connection...');

      this.bearer = await this.getBearerToken();
      await this.adminLogin(this.bearer);

      logger.info('✅ OpenCart API connection successful');
      return true;
    } catch (error: any) {
      logger.error(`❌ OpenCart API connection failed: ${error.message}`);
      return false;
    }
  }

  // ============================================
  // PRODUCT MATCHING (4-TIER ALGORITHM)
  // ============================================

  private calculateStringSimilarity(str1: string, str2: string): number {
    // Simple Levenshtein distance-based similarity
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();

    if (s1 === s2) return 1.0;

    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;

    if (longer.length === 0) return 1.0;

    // Calculate Levenshtein distance
    const editDistance = this.levenshteinDistance(s1, s2);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  private async matchProduct(supabaseProduct: UnifiedProduct): Promise<ProductMatch> {
    // Tier 1: Exact SKU Match (100% confidence)
    if (supabaseProduct.sku) {
      const sbSku = supabaseProduct.sku.toLowerCase();
      const exactMatch = Array.from(this.openCartProductsCache.values()).find(
        (ocp) => ocp.sku && ocp.sku.toLowerCase() === sbSku
      );

      if (exactMatch) {
        return {
          matched: true,
          confidence: 1.0,
          opencart_product_id: exactMatch.product_id,
          match_type: 'exact_sku',
          reasoning: `Exact SKU match: ${supabaseProduct.sku}`,
        };
      }
    }

    // Tier 2: Model + Brand Match (90% confidence)
    if (supabaseProduct.model && supabaseProduct.brand) {
      const modelBrandMatch = Array.from(this.openCartProductsCache.values()).find((ocp) => {
        const ocModel = ocp.model?.toLowerCase() || '';
        const ocName = ocp.name?.toLowerCase() || '';
        const sbModel = supabaseProduct.model?.toLowerCase() || '';
        const sbBrand = supabaseProduct.brand?.toLowerCase() || '';

        return ocModel.includes(sbModel) && ocName.includes(sbBrand);
      });

      if (modelBrandMatch) {
        return {
          matched: true,
          confidence: 0.9,
          opencart_product_id: modelBrandMatch.product_id,
          match_type: 'model_brand',
          reasoning: `Model+Brand match: ${supabaseProduct.model} + ${supabaseProduct.brand}`,
        };
      }
    }

    // Tier 3: Hybrid Fuzzy Matching with Core Identifier Focus
    const sbName = supabaseProduct.product_name.toLowerCase();
    let bestMatch: any = null;
    let bestScore = 0;

    // Extract core identifiers from product name (not brand/model which may be internal codes)
    // Focus on meaningful words (including model identifiers like "pro", "amp", "mini")
    const commonColors = ['grey', 'gray', 'black', 'white', 'silver'];
    const sbCoreWords = sbName
      .split(/[\s\-()]+/)
      .filter((w: string) => {
        // Include words 3+ chars that aren't colors
        return w.length >= 3 && !commonColors.includes(w);
      })
      .slice(0, 5); // Take top 5 meaningful words

    // Pre-filter candidates by shared significant words
    const sbWords = sbName.split(/[\s\-]/).filter((w: string) => w.length > 3);
    const candidates = Array.from(this.openCartProductsCache.values()).filter((ocp) => {
      const ocName = ocp.name.toLowerCase();
      return sbWords.some((word: string) => ocName.includes(word));
    });

    logger.info(`   Fuzzy matching: ${candidates.length} candidates, core words: [${sbCoreWords.join(', ')}]`);

    if (candidates.length > 0 && candidates.length < 200) {
      const topMatches: Array<{name: string; score: number; core: number; lev: number}> = [];

      for (const ocp of candidates) {
        const ocName = ocp.name.toLowerCase();
        const ocWords = ocName.split(/[\s\-()]+/);

        // Calculate hybrid score with position-aware and brevity bonuses:
        // 1. Core words match (50% weight) - must include all key identifiers
        let coreWordsMatched = 0;
        let coreWordsTotal = sbCoreWords.length;
        sbCoreWords.forEach((word: string) => {
          if (!word) return;

          // Handle word stem variations (e.g., "streamer" vs "streaming", "amplifier" vs "amp")
          const wordStem = word.replace(/(ing|er|ed)$/, ''); // Remove common suffixes
          const matched = ocWords.some((ocw: string) => {
            const ocwStem = ocw.replace(/(ing|er|ed)$/, '');
            return ocw.includes(word) || word.includes(ocw) ||
                   ocwStem.includes(wordStem) || wordStem.includes(ocwStem);
          });

          if (matched) coreWordsMatched++;
        });
        const coreScore = coreWordsTotal > 0 ? (coreWordsMatched / coreWordsTotal) : 0;

        // 2. Early position bonus (20% weight) - key words appear early in name
        let earlyPositionScore = 0;
        const firstThreeWords = ocWords.slice(0, 3).join(' ');
        sbCoreWords.forEach((word: string) => {
          if (word && firstThreeWords.includes(word)) {
            earlyPositionScore += (1 / sbCoreWords.length);
          }
        });

        // 3. Brevity bonus (15% weight) - shorter names score higher if core words match
        const sbWordCount = sbName.split(/[\s\-()]+/).filter((w: string) => w.length > 0).length;
        const ocWordCount = ocWords.filter((w: string) => w.length > 0).length;
        const wordCountRatio = Math.min(sbWordCount / Math.max(ocWordCount, 1), 1.0);
        const brevityScore = coreScore > 0.8 ? wordCountRatio : 0; // Only apply if core words match well

        // 4. Levenshtein similarity (15% weight) - overall similarity
        const levenshteinScore = this.calculateStringSimilarity(sbName, ocName);

        // Weighted hybrid score
        const hybridScore = (coreScore * 0.5) + (earlyPositionScore * 0.2) + (brevityScore * 0.15) + (levenshteinScore * 0.15);

        if (hybridScore > bestScore) {
          bestScore = hybridScore;
          bestMatch = ocp;
        }

        // Track top 5 for debugging
        topMatches.push({name: ocp.name, score: hybridScore, core: coreScore, lev: levenshteinScore});
      }

      // Show top 3 matches for debugging
      topMatches.sort((a, b) => b.score - a.score);
      const top3 = topMatches.slice(0, 3);
      if (top3.length > 0) {
        logger.info(`   Top matches:`);
        top3.forEach((m, i) => {
          const pct = Math.round(m.score * 100);
          const corePct = Math.round(m.core * 100);
          const levPct = Math.round(m.lev * 100);
          logger.info(`     ${i+1}. ${pct}% (core:${corePct}%, lev:${levPct}%) - "${m.name}"`);
        });
      }

      if (bestScore >= 0.55) {
        // 55% hybrid threshold (weighted toward core identifiers)
        logger.info(`   ✅ MATCH FOUND: ${Math.round(bestScore * 100)}% - "${bestMatch.name}"`);
        return {
          matched: true,
          confidence: bestScore,
          opencart_product_id: bestMatch.product_id,
          match_type: 'fuzzy_hybrid',
          reasoning: `Hybrid match: ${Math.round(bestScore * 100)}% similar to "${bestMatch.name}"`,
        };
      } else if (bestMatch) {
        logger.info(`   ⚠️  Best: ${Math.round(bestScore * 100)}% - "${bestMatch.name}" (need 55%)`);
      }
    }

    // Tier 4: No match - create new
    return {
      matched: false,
      confidence: 0,
      match_type: 'none',
      reasoning: candidates.length > 0
        ? `Best match only ${Math.round(bestScore * 100)}% similar (threshold: 60%)`
        : 'No similar products found',
    };
  }

  private async aiSemanticMatch(supabaseProduct: UnifiedProduct): Promise<ProductMatch> {
    try {
      // Get top 5 candidate products from cache based on brand similarity
      const candidates = Array.from(this.openCartProductsCache.values())
        .filter((ocp) => {
          const ocName = ocp.name?.toLowerCase() || '';
          const sbBrand = supabaseProduct.brand?.toLowerCase() || '';
          const sbName = supabaseProduct.product_name?.toLowerCase() || '';

          // Pre-filter: must share at least one significant word
          const ocWords = ocName.split(/[\s\-]/).filter((w: string) => w.length > 3);
          const sbWords = sbName.split(/[\s\-]/).filter((w: string) => w.length > 3);

          return ocWords.some((ocw: string) => sbWords.some((sbw: string) => sbw.includes(ocw) || ocw.includes(sbw)));
        })
        .slice(0, 5);

      if (candidates.length === 0) {
        return {
          matched: false,
          confidence: 0,
          match_type: 'none',
        };
      }

      // Ask Claude AI to analyze matches
      const prompt = `You are a product matching expert. Analyze if this Supabase product matches any OpenCart products.

**Supabase Product:**
Name: ${supabaseProduct.product_name}
Brand: ${supabaseProduct.brand || 'Unknown'}
Model: ${supabaseProduct.model || 'Unknown'}
SKU: ${supabaseProduct.sku || 'Unknown'}

**OpenCart Candidates:**
${candidates
  .map(
    (c, i) => `
${i + 1}. ID: ${c.product_id}
   Name: ${c.name}
   Model: ${c.model || 'N/A'}
   SKU: ${c.sku || 'N/A'}
   Manufacturer: ${c.manufacturer || 'N/A'}
`
  )
  .join('')}

Return ONLY valid JSON (no markdown):
{
  "matched": true/false,
  "confidence": 0.0-1.0,
  "opencart_product_id": "id or null",
  "reasoning": "brief explanation"
}

**Matching Rules:**
- Same model + brand = HIGH confidence (0.85+)
- Similar name but different model = MEDIUM confidence (0.70-0.84)
- Different products = NO match (confidence < 0.70)
- Be conservative - when in doubt, return NO match`;

      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = response.content[0];
      if (content.type === 'text') {
        let jsonText = content.text.trim();
        if (jsonText.startsWith('```')) {
          jsonText = jsonText.replace(/```json?\n?/g, '').replace(/```\n?$/g, '');
        }

        const aiResult = JSON.parse(jsonText);

        if (aiResult.matched && aiResult.confidence >= 0.7) {
          return {
            matched: true,
            confidence: aiResult.confidence,
            opencart_product_id: aiResult.opencart_product_id,
            match_type: 'ai_semantic',
            reasoning: aiResult.reasoning,
          };
        }
      }

      return {
        matched: false,
        confidence: 0,
        match_type: 'none',
      };
    } catch (error: any) {
      logger.error(`AI matching error: ${error.message}`);
      return {
        matched: false,
        confidence: 0,
        match_type: 'none',
      };
    }
  }

  // ============================================
  // PRODUCT TRANSFORMATION
  // ============================================

  private transformToOpenCart(product: UnifiedProduct, categoryId: number): OpenCartProduct {
    const manufacturerId = this.getManufacturerIdByBrand(product.brand || 'Unknown');

    // Clean product name (remove pipes and special chars)
    let cleanName = (product.product_name || '')
      .replace(/\|/g, '-')
      .replace(/[<>]/g, '')
      .trim();

    // If product name is overly long (> 150 chars), use model/SKU instead
    // This handles cases where full description was imported as product_name
    if (cleanName.length > 150) {
      logger.info(`   ⚠️  Product name too long (${cleanName.length} chars), using model instead`);
      cleanName = product.model || product.sku || cleanName.substring(0, 100);
    }

    // Add brand prefix with proper spacing
    const brand = (product.brand || '').trim();
    if (brand) {
      // If product name starts with brand (no space), strip it and re-add with space
      const brandLower = brand.toLowerCase();
      const nameLower = cleanName.toLowerCase();

      if (nameLower.startsWith(brandLower)) {
        // Remove brand from start (might be no space like "BSSAR133")
        cleanName = cleanName.substring(brand.length).trim();
      }

      // Truncate BEFORE adding brand to ensure final name is within limit
      // OpenCart requires "less than 255" so max is 254
      // Reserve space for: brand + space + "..." (if truncated)
      const maxProductNameLength = 254 - brand.length - 1 - 3; // -1 for space, -3 for "..."
      if (cleanName.length > maxProductNameLength) {
        cleanName = cleanName.substring(0, maxProductNameLength) + '...';
      }

      // Now add brand with space
      cleanName = `${brand} ${cleanName}`;
    } else {
      // No brand, just truncate to 254 (OpenCart requires < 255)
      if (cleanName.length > 254) {
        cleanName = cleanName.substring(0, 251) + '...';
      }
    }

    const model = product.model || product.sku || 'UNKNOWN';
    const price = Math.round(product.selling_price || 0).toString();

    // Use total_stock (sum of all warehouses) - ensure it's a valid number
    const totalStock = product.total_stock || 0;
    const quantity = Math.max(0, totalStock).toString();

    // Debug logging
    logger.info(`   📊 Stock data for ${product.sku}: total_stock=${product.total_stock}, quantity=${quantity}`);

    const todayDate = new Date().toISOString().split('T')[0];

    return {
      model: model.substring(0, 64), // OpenCart model limit
      sku: product.sku || `sp-${(product as any).id || 'unknown'}`,
      price,
      quantity,
      status: '1',
      manufacturer_id: manufacturerId,
      tax_class_id: '0',
      weight: '0.00000000',
      weight_class_id: 1,
      length: '0.00000000',
      width: '0.00000000',
      height: '0.00000000',
      length_class_id: 1,
      subtract: 1,
      sort_order: 1,
      minimum: 1,
      date_available: todayDate,
      stock_status_id: 6,
      shipping: 1,
      product_store: [0],
      product_category: [categoryId],
      product_description: [
        {
          language_id: '1',
          name: cleanName,
          description: product.description || '',
          meta_title: cleanName,
          meta_description: '',
          meta_keyword: '',
          tag: '',
        },
      ],
    };
  }

  private getManufacturerIdByBrand(brand: string): string {
    const brandMap: Record<string, string> = {
      // Networking
      'tp-link': '367',
      'tplink': '367',

      // Audio brands - TODO: Get correct manufacturer IDs from OpenCart
      'wiim': '0', // Use '0' for now (will show as no manufacturer)
      'denon': '0',
      'marantz': '0',
      'yamaha': '0',
      'polk': '0',
      'klipsch': '0',
      'jbl': '0',
      'anthem': '0',
      'rotel': '0',
      'paradigm': '0',

      // Conferencing
      'yealink': '0',
      'jabra': '0',
      'logitech': '0',
      'poly': '0',
    };

    const brandLower = (brand || '').toLowerCase().trim();

    // Return mapped ID or '0' for no manufacturer (better than wrong manufacturer)
    return brandMap[brandLower] || '0';
  }

  // ============================================
  // MAIN PUSH LOGIC
  // ============================================

  async pushProducts(options?: PushOptions): Promise<PushSessionResult> {
    const startTime = Date.now();
    const results: PushResult[] = [];

    try {
      logger.info('🚀 Starting OpenCart Push Session');

      // Authenticate
      if (!this.bearer) {
        this.bearer = await this.getBearerToken();
        await this.adminLogin(this.bearer);
      }

      // Fetch products from Supabase
      let query = this.supabase
        .getClient()
        .from('products')
        .select('*')
        .eq('active', true)
        .gt('total_stock', 0)
        .not('selling_price', 'is', null) // CRITICAL: Must have price
        .gt('selling_price', 0) // Price must be > 0
        .order('created_at', { ascending: false });

      // Apply brand filter if specified
      if (options?.brand) {
        query = query.ilike('brand', options.brand);
      }

      // Apply supplier filter if specified
      if (options?.supplierId) {
        query = query.eq('supplier_id', options.supplierId);
      }

      // Apply limit (default to all products with valid prices)
      const limit = options?.limit || 10000; // High default to get all valid products
      query = query.limit(limit);

      const { data: products, error } = await query;

      if (error) throw error;
      if (!products || products.length === 0) {
        throw new Error('No active products found in Supabase');
      }

      logger.info(`📦 Found ${products.length} products to push`);

      // Load ALL pushed SKUs from Supabase into a Set (super fast lookups)
      logger.info(`📂 Loading pushed SKUs from Supabase...`);

      // Fetch ALL records with pagination (Supabase defaults to 1000 max)
      let allPushedSkus: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data: batch, error } = await this.supabase
          .getClient()
          .from('pushed_to_opencart')
          .select('sku')
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
          logger.error(`❌ Error loading pushed SKUs: ${error.message}`);
          break;
        }

        if (batch && batch.length > 0) {
          allPushedSkus.push(...batch);
          hasMore = batch.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }

      // Normalize SKUs for consistent matching (lowercase, remove special chars)
      const normalizeSku = (sku: string): string => {
        return sku.trim().toLowerCase().replace(/[\s\-_]/g, '');
      };

      const pushedSkusSet = new Set(
        allPushedSkus.map((e: any) => normalizeSku(e.sku))
      );
      logger.info(`✅ Loaded ${pushedSkusSet.size} already-pushed SKUs into cache`);

      const liveFeedCategoryId = parseInt(process.env.OPENCART_LIVEFEED_CATEGORY_ID || '967');

      let created = 0;
      let updated = 0;
      let skipped = 0;
      let failed = 0;

      for (let i = 0; i < products.length; i++) {
        const product = products[i];

        logger.info(`[${i + 1}/${products.length}] Processing: ${product.product_name}`);

        try {
          // Check if already pushed (using fast Set lookup with normalized SKU)
          const productSku = product.model || product.sku || '';
          const normalizedProductSku = normalizeSku(productSku);

          if (normalizedProductSku && pushedSkusSet.has(normalizedProductSku)) {
            logger.info(`⏭️  Skipped (already pushed): ${product.product_name} (SKU: ${productSku})`);
            skipped++;
            results.push({
              success: true,
              product_id: (product as any).id || 'unknown',
              product_name: product.product_name,
              action: 'skipped',
            });
            continue;
          }

          // Not in tracking table - create it
          let matchResult: ProductMatch = { matched: false, confidence: 0, match_type: 'none' as const };

          if (options?.dryRun) {
            const action = matchResult.matched ? 'UPDATE' : 'CREATE';
            logger.info(
              `[DRY RUN] Would ${action}: ${product.product_name}` +
              (matchResult.matched ? ` (Match: ${matchResult.match_type}, ${Math.round(matchResult.confidence * 100)}%)` : '')
            );
            results.push({
              success: true,
              product_id: (product as any).id || 'unknown',
              product_name: product.product_name,
              action: 'skipped',
              match_info: matchResult,
            });
            skipped++;
            continue;
          }

          // MATCHED: Update existing product (price + stock only)
          if (matchResult.matched && matchResult.opencart_product_id) {
            const updates = {
              price: Math.round(product.selling_price || 0).toString(),
              quantity: Math.max(0, product.total_stock || 0).toString(),
            };

            // Skip updates to avoid duplicates (update API not yet implemented)
            results.push({
              success: true,
              product_id: (product as any).id || 'unknown',
              product_name: product.product_name,
              action: 'skipped',
              opencart_id: matchResult.opencart_product_id,
              match_info: matchResult,
            });

            skipped++;
            logger.info(
              `⏭️  Skipped (exists): ${product.product_name} → OpenCart ID ${matchResult.opencart_product_id} ` +
              `(${matchResult.match_type}: ${Math.round(matchResult.confidence * 100)}%)`
            );
          }
          // NOT MATCHED: Create new product in LiveFeed
          else {
            const ocProduct = this.transformToOpenCart(product, liveFeedCategoryId);
            const response = await this.addProduct(ocProduct);

            // Mark as pushed in Supabase tracking table and add to Set
            if (productSku) {
              await this.markProductAsPushed(productSku, response?.product_id);
              pushedSkusSet.add(normalizedProductSku); // Add normalized SKU to Set immediately
            }

            // Add to cache immediately to prevent duplicates in same session
            if (response?.product_id) {
              this.openCartProductsCache.set(response.product_id, {
                product_id: response.product_id,
                name: ocProduct.product_description.find((d: any) => d.language_id === '1')?.name || product.product_name,
                model: ocProduct.model,
                sku: ocProduct.sku || '',
                price: ocProduct.price,
                quantity: ocProduct.quantity,
              });
            }

            results.push({
              success: true,
              product_id: (product as any).id || 'unknown',
              product_name: product.product_name,
              action: 'created',
              opencart_id: response?.product_id,
              match_info: matchResult,
            });

            created++;
            logger.info(`✅ Created: ${product.product_name} (OpenCart ID: ${response?.product_id})`);
          }

          // Rate limiting
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (error: any) {
          logger.error(`❌ Failed: ${product.product_name} - ${error.message}`);
          results.push({
            success: false,
            product_id: (product as any).id || 'unknown',
            product_name: product.product_name,
            action: 'failed',
            error: error.message,
          });
          failed++;
        }
      }

      const durationSeconds = Math.floor((Date.now() - startTime) / 1000);

      logger.info('📊 Push Session Complete');
      logger.info(`   Created: ${created}`);
      logger.info(`   Updated: ${updated}`);
      logger.info(`   Skipped: ${skipped}`);
      logger.info(`   Failed: ${failed}`);
      logger.info(`   Duration: ${durationSeconds}s`);

      return {
        success: true,
        session_id: `push-${Date.now()}`,
        products_created: created,
        products_updated: updated,
        products_skipped: skipped,
        products_failed: failed,
        results,
        duration_seconds: durationSeconds,
      };
    } catch (error: any) {
      logger.error(`❌ Push session failed: ${error.message}`);

      const durationSeconds = Math.floor((Date.now() - startTime) / 1000);

      return {
        success: false,
        session_id: `push-${Date.now()}`,
        products_created: 0,
        products_updated: 0,
        products_skipped: 0,
        products_failed: 0,
        results,
        duration_seconds: durationSeconds,
      };
    }
  }
}

export default OpenCartPushServer;
