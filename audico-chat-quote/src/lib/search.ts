import OpenAI from "openai";
import { getSupabaseServer } from "./supabase";
import type { Product, SearchFilters, ComponentType } from "./types";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

/**
 * Fixed search queries for each component type
 * These are deterministic - no AI involvement in query generation
 * Using specific brand/model patterns to ensure correct product types
 */
const COMPONENT_SEARCH_QUERIES: Record<ComponentType, string> = {
  avr: "Denon AVR Marantz Yamaha RX receiver HDMI surround",
  fronts: "Klipsch KEF Bowers Wilkins DALI floorstanding tower speaker",
  center: "center channel speaker dialogue Klipsch KEF",
  surrounds: "surround speaker bookshelf satellite rear",
  subwoofer: "subwoofer powered SVS REL Klipsch bass",
  height: "Dolby Atmos height speaker upfiring ceiling-bounce Klipsch KEF",
  amp: "Sonos Amp Yamaha WXA MusicCast amplifier streaming",
  ceiling_speakers: "ceiling speaker Bose Sonance Klipsch Tannoy in-ceiling",
  ceiling_speakers_z2: "ceiling speaker Bose Sonance Tannoy architectural",
  outdoor_speakers: "outdoor speaker weatherproof Sonos Klipsch garden patio",
  wall_speakers: "wall mount speaker surface JBL Bose",
  source: "WiiM Bluesound Node Sonos Port streamer network player",
};

/**
 * Brand patterns that MUST appear in product name for each component type
 * This provides a hard filter to ensure correct product types
 */
const COMPONENT_BRAND_PATTERNS: Record<ComponentType, RegExp | null> = {
  avr: /\b(denon|marantz|yamaha|onkyo|pioneer|sony)\b.*\b(avr|rx-|sr-|receiver|cinema)\b|\b(receiver|surround)\b.*\b(denon|marantz|yamaha)\b/i,
  fronts: /\b(speaker|floorstand|tower|bookshelf)\b/i,
  center: /\b(center|centre|channel)\b/i,
  surrounds: /\b(surround|satellite|bookshelf|speaker)\b/i,
  subwoofer: /\b(sub|subwoofer|bass)\b/i,
  height: /\b(atmos|height|upfiring|ceiling)\b/i,
  amp: /\b(sonos\s*amp|yamaha.*amp|musiccast|wxa|amplifier)\b/i,
  ceiling_speakers: /\b(ceiling|in-ceiling|architectural)\b/i,
  ceiling_speakers_z2: /\b(ceiling|in-ceiling|architectural)\b/i,
  outdoor_speakers: /\b(outdoor|weatherproof|garden|patio)\b/i,
  wall_speakers: /\b(wall|surface|mount)\b.*\b(speaker)\b/i,
  source: /\b(wiim|bluesound|node|sonos\s*port|streamer|network\s*player)\b/i,
};

/**
 * Category filters for each component type
 * Multiple categories per component to catch variations in naming
 * These are the ACTUAL category_name values from the Supabase database
 */
const COMPONENT_CATEGORIES: Record<ComponentType, string[]> = {
  avr: [
    "Audio Visual",
    "Audio Equipment",
    "TV VIDEO HIFI",
  ],
  amp: [
    "AMPLIFIERS",
    "Home Tech &Gt; Hifi + Audio &Gt; Integrated Amps",
    "Audio Equipment",
  ],
  subwoofer: [
    "Home Tech &Gt; Speakers &Gt; Subwoofers",
    "SPEAKERS",
  ],
  source: [
    "Audio Equipment",
    "Home Tech &Gt; Smart Home",
  ],
  fronts: [
    "Home Tech &gt; Speakers &gt; FloorStanding",
    "Home Tech &Gt; Speakers &Gt; Bookshelf",
    "Home Tech &Gt; Speakers",
    "SPEAKERS",
  ],
  center: [
    "Home Tech &Gt; Speakers",
    "SPEAKERS",
  ],
  surrounds: [
    "Home Tech &Gt; Speakers &Gt; Bookshelf",
    "Home Tech &Gt; Speakers &Gt; Architectural",
    "SPEAKERS",
  ],
  height: [
    "Home Tech &Gt; Speakers &Gt; Bookshelf",
    "Home Tech &Gt; Speakers",
    "SPEAKERS",
  ],
  ceiling_speakers: [
    "Home Tech &Gt; Speakers &Gt; Architectural",
    "Commercial &Gt; Speakers",
    "Commercial Audio",
    "SPEAKERS",
  ],
  ceiling_speakers_z2: [
    "Home Tech &Gt; Speakers &Gt; Architectural",
    "Commercial &Gt; Speakers",
    "Commercial Audio",
    "SPEAKERS",
  ],
  outdoor_speakers: [
    "Home Tech &Gt; Speakers &Gt; Outdoor",
    "Commercial &Gt; Speakers",
    "SPEAKERS",
  ],
  wall_speakers: [
    "Commercial &Gt; Speakers",
    "Commercial Audio",
    "SPEAKERS",
  ],
};

/**
 * Negative keywords - products containing these words should be filtered out
 * for the given component type. Extended list for better accuracy.
 */
const COMPONENT_EXCLUDE_KEYWORDS: Record<ComponentType, string[]> = {
  avr: ["speaker", "headphone", "cable", "soundbar", "subwoofer", "mount", "bracket"],
  amp: ["speaker", "subwoofer", "headphone", "earphone", "cable", "bracket", "mount", "stand", "receiver"],
  subwoofer: ["amplifier", "receiver", "speaker cable", "mount", "bracket", "stand"],
  source: ["speaker", "headphone", "cable", "mount", "stand", "bracket", "amplifier", "receiver"],
  fronts: ["subwoofer", "amplifier", "receiver", "cable", "center", "centre", "surround", "ceiling", "outdoor"],
  center: ["subwoofer", "amplifier", "receiver", "cable", "floorstanding", "tower", "outdoor", "ceiling"],
  surrounds: ["subwoofer", "amplifier", "receiver", "cable", "floorstanding", "tower", "center", "centre"],
  height: ["subwoofer", "amplifier", "receiver", "cable", "floorstanding", "tower", "center", "centre", "outdoor"],
  ceiling_speakers: ["outdoor", "amplifier", "subwoofer", "receiver", "floorstanding", "weatherproof", "microphone", "array mic", "mxa920", "mxa910", "ceiling array"],
  ceiling_speakers_z2: ["outdoor", "amplifier", "subwoofer", "receiver", "floorstanding", "weatherproof", "microphone", "array mic", "mxa920", "mxa910", "ceiling array"],
  outdoor_speakers: ["ceiling", "in-ceiling", "amplifier", "subwoofer", "receiver", "floorstanding"],
  wall_speakers: ["ceiling", "outdoor", "amplifier", "subwoofer", "receiver", "floorstanding"],
};

/**
 * Budget allocations per component (percentage of total budget)
 */
const BUDGET_ALLOCATION: Record<ComponentType, { min: number; max: number }> = {
  avr: { min: 0.15, max: 0.30 },
  fronts: { min: 0.20, max: 0.35 },
  center: { min: 0.05, max: 0.15 },
  surrounds: { min: 0.05, max: 0.15 },
  height: { min: 0.05, max: 0.15 },
  subwoofer: { min: 0.08, max: 0.20 },
  amp: { min: 0.20, max: 0.40 },
  ceiling_speakers: { min: 0.15, max: 0.30 },
  ceiling_speakers_z2: { min: 0.10, max: 0.25 },
  outdoor_speakers: { min: 0.10, max: 0.25 },
  wall_speakers: { min: 0.10, max: 0.25 },
  source: { min: 0.05, max: 0.15 },
};

/**
 * Generate embedding for a search query using OpenAI
 */
async function generateEmbedding(query: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: query,
  });
  return response.data[0].embedding;
}

/**
 * Transform database product to our Product type
 */
function transformProduct(dbProduct: any): Product {
  return {
    id: dbProduct.id,
    name: dbProduct.product_name,
    sku: dbProduct.sku,
    model: dbProduct.model,
    brand: dbProduct.brand,
    category: dbProduct.category_name,
    price: parseFloat(String(dbProduct.retail_price || 0)),
    cost: parseFloat(String(dbProduct.cost_price || 0)),
    stock: {
      total: dbProduct.total_stock || 0,
      jhb: dbProduct.stock_jhb || 0,
      cpt: dbProduct.stock_cpt || 0,
      dbn: dbProduct.stock_dbn || 0,
    },
    images: dbProduct.images || [],
    specifications: dbProduct.specifications || {},
    useCase: dbProduct.use_case,
    opencartProductId: dbProduct.opencart_product_id,
  };
}

/**
 * Search products using hybrid search (vector + BM25)
 */
export async function searchProducts(
  query: string,
  filters: SearchFilters = {},
  limit: number = 30
): Promise<Product[]> {
  const supabase = getSupabaseServer();

  // Generate embedding for the query
  const embedding = await generateEmbedding(query);

  // Call hybrid search function
  // Using 0.3/0.7 weights to favor BM25 keyword matching over semantic similarity
  // This helps prevent category confusion (e.g., amp returning speakers)
  const { data, error } = await supabase.rpc("hybrid_product_search", {
    query_text: query,
    query_embedding: embedding,
    min_price: filters.minPrice || 0,
    max_price: filters.maxPrice || 999999999,
    brand_filter: filters.brand || null,
    category_filter: filters.category || null,
    in_stock_only: filters.inStockOnly ?? false,
    result_limit: Math.min(limit, 500),
    vector_weight: 0.3,
    bm25_weight: 0.7,
    use_case_filter: filters.useCase || null,
  });

  if (error) {
    console.error("Search error:", error);
    throw new Error(`Search failed: ${error.message}`);
  }

  let results = (data || []).map(transformProduct);

  // Apply car audio filter for home audio searches
  const isHomeAudioSearch = [
    "fronts", "center", "surrounds", "subwoofer",
    "passive_speaker", "bookshelf", "floorstanding"
  ].some(term => query.toLowerCase().includes(term));

  if (isHomeAudioSearch) {
    results = filterOutCarAudio(results);
  }

  return results;
}

/**
 * Search for products for a specific component type
 * Uses fixed queries and strict category filtering - no AI involvement
 * Searches across multiple category variations for each component
 */
export async function searchForComponent(
  component: ComponentType,
  options: {
    budgetTotal?: number;
    brand?: string;
    useCase?: "Home" | "Commercial";
    channels?: string;
  } = {}
): Promise<Product[]> {
  // Get the fixed search query for this component
  let searchQuery = COMPONENT_SEARCH_QUERIES[component];

  // Add channel info to AVR searches
  if (component === "avr" && options.channels) {
    searchQuery = `${options.channels} ${searchQuery}`;
  }

  // Calculate budget range for this component
  const allocation = BUDGET_ALLOCATION[component];
  const budgetTotal = options.budgetTotal || 200000; // Default R200k budget
  const minPrice = Math.round(budgetTotal * allocation.min * 0.5); // Allow some flexibility below
  const maxPrice = Math.round(budgetTotal * allocation.max * 1.5); // Allow some flexibility above

  // Get category variations for this component
  const categories = COMPONENT_CATEGORIES[component] || [];
  const excludeKeywords = COMPONENT_EXCLUDE_KEYWORDS[component] || [];

  let allProducts: Product[] = [];

  // Search with each category variation to maximize coverage
  if (categories.length > 0) {
    // Try each category - some may not exist in the DB, that's OK
    for (const category of categories.slice(0, 3)) { // Limit to top 3 categories
      const filters: SearchFilters = {
        minPrice: minPrice,
        maxPrice: maxPrice,
        brand: options.brand,
        useCase: options.useCase,
        inStockOnly: false,
        category: category,
      };

      try {
        const products = await searchProducts(searchQuery, filters, 15);
        allProducts.push(...products);
      } catch (e) {
        // Category might not exist, continue with next
        console.log(`Category search failed for ${category}:`, e);
      }
    }
  }

  // If category search returned too few results, do a fallback search without category
  if (allProducts.length < 5) {
    const fallbackFilters: SearchFilters = {
      minPrice: minPrice,
      maxPrice: maxPrice,
      brand: options.brand,
      useCase: options.useCase,
      inStockOnly: false,
    };
    const fallbackProducts = await searchProducts(searchQuery, fallbackFilters, 30);
    allProducts.push(...fallbackProducts);

    // Filter car audio from fallback results
    if (["fronts", "center", "surrounds", "height", "subwoofer"].includes(component)) {
      allProducts = filterOutCarAudio(allProducts);
    }
  }

  // Deduplicate by product ID
  const uniqueProducts = Array.from(
    new Map(allProducts.map((p) => [p.id, p])).values()
  );

  // Apply negative keyword filtering - this is critical for preventing wrong products
  let filteredProducts = uniqueProducts;
  if (excludeKeywords.length > 0) {
    filteredProducts = uniqueProducts.filter((p) => {
      const nameLower = p.name.toLowerCase();
      const categoryLower = (p.category || "").toLowerCase();
      // Check both name and category for exclusion keywords
      return !excludeKeywords.some(
        (kw) => nameLower.includes(kw.toLowerCase()) || categoryLower.includes(kw.toLowerCase())
      );
    });
  }

  // Limit to top 10 after filtering
  filteredProducts = filteredProducts.slice(0, 10);

  // Sort by price within range (mid-range first)
  const targetPrice = (minPrice + maxPrice) / 2;
  return filteredProducts.sort((a, b) => {
    const distA = Math.abs(a.price - targetPrice);
    const distB = Math.abs(b.price - targetPrice);
    return distA - distB;
  });
}

/**
 * Search for products by brand (for matching center/surrounds to fronts)
 */
export async function searchByBrand(
  component: ComponentType,
  brand: string,
  maxPrice?: number
): Promise<Product[]> {
  const searchQuery = `${brand} ${COMPONENT_SEARCH_QUERIES[component]}`;

  const filters: SearchFilters = {
    brand: brand,
    maxPrice: maxPrice,
    inStockOnly: false,
  };

  return searchProducts(searchQuery, filters, 5);
}

/**
 * Search for products by component_type field (NEW - uses enriched data)
 * This is the preferred method once products have been enriched with component_type
 */
export async function searchByComponentType(
  componentType: string,
  options: {
    minPrice?: number;
    maxPrice?: number;
    brand?: string;
    limit?: number;
  } = {}
): Promise<Product[]> {
  const supabase = getSupabaseServer();

  let query = supabase
    .from("products")
    .select("*")
    .eq("component_type", componentType)
    .eq("active", true);

  // Apply price filters
  if (options.minPrice) {
    query = query.gte("retail_price", options.minPrice);
  }
  if (options.maxPrice) {
    query = query.lte("retail_price", options.maxPrice);
  }

  // Sort by: stock availability (in-stock first), then by price (affordable first)
  // This ensures customers see available, affordable options first
  query = query
    .order("stock_jhb", { ascending: false, nullsFirst: false })
    .order("retail_price", { ascending: true });

  // Apply brand filter
  if (options.brand) {
    query = query.ilike("brand", `%${options.brand}%`);
  }

  // Order by price and limit results
  query = query
    .order("retail_price", { ascending: true })
    .limit(options.limit || 10);

  const { data, error } = await query;

  if (error) {
    console.error("searchByComponentType error:", error);
    return [];
  }

  return (data || []).map(transformProduct);
}

/**
 * Minimum sensible prices for home cinema components
 * Prevents returning cheap junk like USB speakers or misclassified products
 */
const COMPONENT_MIN_PRICES: Record<string, number> = {
  avr: 5000,           // Real AVRs start around R8k, R5k gives some margin
  fronts: 3000,        // Real floorstanding/bookshelf speakers
  center: 2000,        // Real center speakers
  surrounds: 1500,     // Real surround speakers
  height: 1500,        // Real height/Atmos speakers
  subwoofer: 5000,     // Real powered home subwoofers (Klipsch, SVS, etc. start ~R6k)
  amp: 3000,           // Real streaming amps (Sonos Amp ~R10k)
  ceiling_speakers: 800,   // Per speaker
  outdoor_speakers: 1000,
  wall_speakers: 800,
  source: 2000,        // Real streamers (WiiM Pro ~R4k)
};

/**
 * Keywords that indicate CAR AUDIO products (not home speakers)
 * These should be filtered out for home cinema categories
 */
const CAR_AUDIO_KEYWORDS = [
  "coaxial",
  "component speaker",  // car audio component speakers
  "6x9",
  "6.5inch",
  "6.5\"",
  "car speaker",
  "car subwoofer",
  "vehicle",
  "automotive",
  "toyota",
  "honda",
  "bmw",
  "mercedes",
  "hertz ",  // Hertz is a car audio brand (with space to avoid "hertz" in specs)
  "focal kit",  // Focal KIT products are car audio
  "integration",
  "dieci",
  "cento",
  "uno series",
  "jbl club",  // JBL Club series is car audio
  "replacement driver",  // Not complete subwoofers
  "replacement subwoofer",  // Not complete units
];

/**
 * Brands that are NOT home audio (car audio, cables, etc.)
 */
const NON_HOME_AUDIO_BRANDS = [
  "hertz",      // Car audio brand
  "aq",         // AudioQuest makes cables, not speakers
  "audioquest", // AudioQuest cables
  "qtx",        // DJ/PA replacement drivers
];

/**
 * Keywords that indicate NOT an amplifier (for amp filtering)
 */
const NOT_AN_AMPLIFIER_KEYWORDS = [
  "turntable",
  "vinyl",
  "33rpm",
  "45rpm",
  "78rpm",
  "33/45",
  "record player",
  "headphone amplifier",
  "headphone amp",
  "tone pocket",    // Ashdown Tone Pocket is a headphone amp
  "guitar amp",
  "bass amp",
  "instrument amp",
  "car amplifier",  // Car audio amps
  // Focal car audio amplifier series
  "focal fds",      // Focal FDS series are car amps
  "focal iy impulse", // Focal IY Impulse series are car amps
  "fds 4.",         // FDS 4.xxx pattern (e.g., FDS 4.350)
  "iy impulse",     // IY IMPULSE series
  // JBL car audio amplifiers
  "jbl amp",        // JBL AMPRF series are car amps
  "amprf",          // JBL AMPRF model prefix
  // Generic car amp patterns
  "compact amplifier", // Usually car audio
  "4ch class",      // 4-channel ClassD typically car audio
  "2ch class",      // 2-channel ClassD typically car audio
];

/**
 * Filter out products that are NOT amplifiers from amp results
 */
function filterOutNonAmplifiers(products: Product[]): Product[] {
  return products.filter((p) => {
    const nameLower = p.name.toLowerCase();
    const skuLower = (p.sku || "").toLowerCase();

    // Check for non-amplifier keywords
    for (const keyword of NOT_AN_AMPLIFIER_KEYWORDS) {
      if (nameLower.includes(keyword.toLowerCase())) {
        console.log(`[FilterNonAmp] Excluded: ${p.name} (matched: ${keyword})`);
        return false;
      }
    }

    // Gemini TT series are turntables (TT = TurnTable)
    if (nameLower.includes("gemini tt") || skuLower.startsWith("tt ") || skuLower.startsWith("tt-")) {
      console.log(`[FilterNonAmp] Excluded: ${p.name} (Gemini TT turntable)`);
      return false;
    }

    return true;
  });
}

/**
 * Filter out car audio and non-home-audio products from results
 */
export function filterOutCarAudio(products: Product[]): Product[] {
  return products.filter((p) => {
    const nameLower = p.name.toLowerCase();
    const brandLower = (p.brand || "").toLowerCase();

    // Check for car audio keywords
    for (const keyword of CAR_AUDIO_KEYWORDS) {
      if (nameLower.includes(keyword.toLowerCase())) {
        console.log(`[FilterCarAudio] Excluded: ${p.name} (matched: ${keyword})`);
        return false;
      }
    }

    // Check for non-home-audio brands
    for (const brand of NON_HOME_AUDIO_BRANDS) {
      if (brandLower === brand) {
        console.log(`[FilterCarAudio] Excluded: ${p.name} (brand: ${brand})`);
        return false;
      }
    }

    return true;
  });
}

/**
 * Smart search for component - tries component_type first, falls back to semantic search
 * This provides the best of both worlds during the enrichment transition
 */
export async function smartSearchForComponent(
  component: ComponentType,
  options: {
    budgetTotal?: number;
    brand?: string;
    useCase?: "Home" | "Commercial";
    channels?: string;
  } = {}
): Promise<Product[]> {
  // Map ComponentType to component_type values in DB
  const componentTypeMap: Record<ComponentType, string> = {
    avr: "avr",
    fronts: "fronts",
    center: "center",
    surrounds: "surrounds",
    height: "height",
    subwoofer: "subwoofer",
    amp: "amp",
    ceiling_speakers: "ceiling_speakers",
    ceiling_speakers_z2: "ceiling_speakers",
    outdoor_speakers: "outdoor_speakers",
    wall_speakers: "wall_speakers",
    source: "source",
  };

  const dbComponentType = componentTypeMap[component];

  // Always apply minimum price to filter out misclassified junk
  const componentMinPrice = COMPONENT_MIN_PRICES[dbComponentType] || 500;
  let minPrice: number = componentMinPrice;
  let maxPrice: number | undefined;

  if (options.budgetTotal) {
    const allocation = BUDGET_ALLOCATION[component];
    // Use the higher of: calculated min or component min
    const calculatedMin = Math.round(options.budgetTotal * allocation.min * 0.3);
    minPrice = Math.max(calculatedMin, componentMinPrice);
    maxPrice = Math.round(options.budgetTotal * allocation.max * 2.0);
    console.log(`[SmartSearch] Budget R${options.budgetTotal}, price range: R${minPrice} - R${maxPrice}`);
  } else {
    console.log(`[SmartSearch] No budget - using min price R${minPrice} to filter junk`);
  }

  // Try component_type search first (fast and accurate if enriched)
  console.log(`[SmartSearch] Trying component_type search for: ${dbComponentType}`);
  let products = await searchByComponentType(dbComponentType, {
    minPrice,
    maxPrice,
    brand: options.brand,
    limit: 15,
  });

  // Filter out car audio for home speaker/subwoofer categories
  if (["fronts", "center", "surrounds", "height", "subwoofer"].includes(dbComponentType)) {
    products = filterOutCarAudio(products);
  }

  // Filter out turntables and headphone amps from amp results
  if (dbComponentType === "amp") {
    products = filterOutNonAmplifiers(products);
  }

  // If we got good results, return them
  if (products.length >= 3) {
    console.log(`[SmartSearch] Found ${products.length} products via component_type`);
    return products.slice(0, 10);
  }

  // If we found some but not enough, try again without max price (but KEEP min price to filter junk)
  if (products.length > 0 && products.length < 3 && maxPrice) {
    console.log(`[SmartSearch] Only found ${products.length}, retrying without max price filter`);
    const allProducts = await searchByComponentType(dbComponentType, {
      minPrice: componentMinPrice, // Keep minimum to filter out junk
      brand: options.brand,
      limit: 15,
    });
    if (allProducts.length >= 3) {
      console.log(`[SmartSearch] Found ${allProducts.length} products without max price filter`);
      return allProducts.slice(0, 10);
    }
  }

  // Fall back to the old semantic search method
  console.log(`[SmartSearch] Falling back to semantic search (only found ${products.length} products)`);
  return searchForComponent(component, options);
}

/**
 * Search products with timeout protection and fallback
 * Uses semantic search first, but falls back to keyword search on timeout
 * This is the SAFE function to use for any user query
 */
export async function searchProductsSafe(
  query: string,
  filters: SearchFilters = {},
  limit: number = 6
): Promise<Product[]> {
  try {
    // Try semantic search first (best results but can timeout)
    return await searchProducts(query, filters, limit);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // If timeout or other error, fall back to keyword search
    if (errorMessage.includes("timeout") || errorMessage.includes("canceling")) {
      console.log(`[searchProductsSafe] Semantic search timed out, falling back to keyword search for: ${query}`);
      return searchByKeywords(query, filters, limit);
    }

    // Re-throw other errors
    throw error;
  }
}

/**
 * Fast keyword-based search without embeddings
 * Used as fallback when semantic search times out
 */
export async function searchByKeywords(
  query: string,
  filters: SearchFilters = {},
  limit: number = 6
): Promise<Product[]> {
  const supabase = getSupabaseServer();

  // Extract meaningful words from query (ignore short words)
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 5); // Limit to 5 keywords

  if (words.length === 0) {
    return [];
  }

  // Detect what type of audio product is being searched for
  const queryLower = query.toLowerCase();
  const isAVRSearch = /\b(avr|receiver)\b/.test(queryLower) &&
    !/\b(bluetooth|wireless|wifi|transmitter|extender|hdmi)\b/.test(queryLower);
  const isSubwooferSearch = /\b(subwoofer|sub)\b/.test(queryLower);
  const isAmpSearch = /\b(amplifier|amp)\b/.test(queryLower) && !/\b(headphone|guitar|bass)\b/.test(queryLower);
  const isSpeakerSearch = /\b(speaker|bookshelf|floor|tower)\b/.test(queryLower);

  // Apply intelligent minimum price based on product type to filter junk
  let intelligentMinPrice = filters.minPrice || 0;
  if (isAVRSearch) {
    intelligentMinPrice = Math.max(intelligentMinPrice, COMPONENT_MIN_PRICES.avr);
    console.log(`[searchByKeywords] AVR search detected - applying min price R${intelligentMinPrice}`);
  } else if (isSubwooferSearch) {
    intelligentMinPrice = Math.max(intelligentMinPrice, COMPONENT_MIN_PRICES.subwoofer);
    console.log(`[searchByKeywords] Subwoofer search detected - applying min price R${intelligentMinPrice}`);
  } else if (isAmpSearch) {
    intelligentMinPrice = Math.max(intelligentMinPrice, COMPONENT_MIN_PRICES.amp);
    console.log(`[searchByKeywords] Amp search detected - applying min price R${intelligentMinPrice}`);
  } else if (isSpeakerSearch) {
    intelligentMinPrice = Math.max(intelligentMinPrice, 2000); // Reasonable min for speakers
    console.log(`[searchByKeywords] Speaker search detected - applying min price R${intelligentMinPrice}`);
  }

  // Build OR conditions for each keyword
  const orConditions = words.map((kw) => `product_name.ilike.%${kw}%`).join(",");

  let queryBuilder = supabase
    .from("products")
    .select("*")
    .eq("active", true)
    .or(orConditions);

  // Apply price filters (use intelligent minimum)
  if (intelligentMinPrice > 0) {
    queryBuilder = queryBuilder.gte("retail_price", intelligentMinPrice);
  }
  if (filters.maxPrice) {
    queryBuilder = queryBuilder.lte("retail_price", filters.maxPrice);
  }

  // Sort by stock then price
  queryBuilder = queryBuilder
    .order("stock_jhb", { ascending: false, nullsFirst: false })
    .order("retail_price", { ascending: true })
    .limit(limit * 2); // Get more results before filtering

  const { data, error } = await queryBuilder;

  if (error) {
    console.error("[searchByKeywords] Error:", error);
    return [];
  }

  let results = data || [];

  // Post-filter to exclude irrelevant products
  const isAudioSearch = isAVRSearch || isSubwooferSearch || isAmpSearch || isSpeakerSearch;

  if (isAudioSearch) {
    // Exclude non-audio products that match audio keywords
    const audioExclude = [
      "poe", "injector", "splitter", "ethernet", "rj45", "switch", "router", "detector",
      "bluetooth transmitter", "bluetooth receiver", "hdmi extender", "wifi switch",
      "charger", "charging", "smart switch", "rf receiver", "promate", "sonoff",
      "ugreen extender"
    ];
    results = results.filter(p => {
      const nameLower = p.product_name.toLowerCase();
      return !audioExclude.some(term => nameLower.includes(term));
    });

    // For AVR searches, exclude brands that don't make AVRs
    if (isAVRSearch) {
      const nonAVRBrands = ["seetronic", "promate", "sonoff", "ugreen", "audioquest", "aq"];
      results = results.filter(p => {
        const brandLower = (p.brand || "").toLowerCase();
        return !nonAVRBrands.includes(brandLower);
      });
    }
  }

  // IMPROVED SORTING: Show mid-range products first when no maxPrice specified
  // Without budget constraints, showing cheapest products first (R2,990) is wrong
  // Better to show products in 25th-75th percentile range (mid-range "best value")
  if (results.length > 4 && !filters.maxPrice) {
    // Calculate price percentiles
    const prices = results.map(p => p.retail_price || 0).sort((a, b) => a - b);
    const p25Index = Math.floor(prices.length * 0.25);
    const p75Index = Math.floor(prices.length * 0.75);
    const p25 = prices[p25Index];
    const p75 = prices[p75Index];

    console.log(`[searchByKeywords] No maxPrice specified - applying mid-range prioritization`);
    console.log(`[searchByKeywords] Price percentiles: 25th=R${p25}, 75th=R${p75}`);

    // Sort to prioritize products in middle price range (25th-75th percentile)
    results.sort((a, b) => {
      const priceA = a.retail_price || 0;
      const priceB = b.retail_price || 0;

      const aInRange = priceA >= p25 && priceA <= p75;
      const bInRange = priceB >= p25 && priceB <= p75;

      // Prioritize products in mid-range
      if (aInRange && !bInRange) return -1;
      if (!aInRange && bInRange) return 1;

      // Within same category (both in range or both out of range):
      // 1. Prefer in-stock products
      if (a.stock_jhb > 0 && b.stock_jhb === 0) return -1;
      if (a.stock_jhb === 0 && b.stock_jhb > 0) return 1;

      // 2. Sort by price ascending (prefer lower end of range)
      return priceA - priceB;
    });

    console.log(`[searchByKeywords] Sorted ${results.length} products - mid-range first, then cheapest, then premium`);
  } else if (filters.maxPrice) {
    console.log(`[searchByKeywords] maxPrice specified (R${filters.maxPrice}) - using default price ascending sort`);
  }

  console.log(`[searchByKeywords] Found ${results.length} products for: ${query}`);
  return results.slice(0, limit).map(transformProduct);
}
