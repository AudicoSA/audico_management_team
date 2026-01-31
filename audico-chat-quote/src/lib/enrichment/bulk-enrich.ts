import { getSupabaseServer } from "@/lib/supabase";
import { classifyProduct, updateProductComponentType, type ComponentTypeClassification } from "./classifier";

interface EnrichmentProgress {
  total: number;
  processed: number;
  successful: number;
  failed: number;
  currentBatch: number;
  totalBatches: number;
}

type ProgressCallback = (progress: EnrichmentProgress) => void;

/**
 * Bulk enrich all products that don't have a component_type set
 * Processes in batches to avoid memory issues and allow progress tracking
 */
export async function bulkEnrichProducts(
  options: {
    batchSize?: number;
    onProgress?: ProgressCallback;
    dryRun?: boolean;
  } = {}
): Promise<EnrichmentProgress> {
  const { batchSize = 50, onProgress, dryRun = false } = options;
  const supabase = getSupabaseServer();

  // Count products that need enrichment
  const { count, error: countError } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true })
    .is("component_type", null)
    .eq("active", true);

  if (countError) {
    throw new Error(`Failed to count products: ${countError.message}`);
  }

  const total = count || 0;
  const totalBatches = Math.ceil(total / batchSize);

  console.log(`[BulkEnrich] Found ${total} products to classify in ${totalBatches} batches`);

  const progress: EnrichmentProgress = {
    total,
    processed: 0,
    successful: 0,
    failed: 0,
    currentBatch: 0,
    totalBatches,
  };

  if (total === 0) {
    console.log("[BulkEnrich] No products need enrichment");
    return progress;
  }

  // Process in batches
  let offset = 0;
  while (offset < total) {
    progress.currentBatch++;

    // Fetch batch of products
    const { data: products, error: fetchError } = await supabase
      .from("products")
      .select("id, product_name, brand, category_name")
      .is("component_type", null)
      .eq("active", true)
      .range(offset, offset + batchSize - 1);

    if (fetchError) {
      console.error(`[BulkEnrich] Batch ${progress.currentBatch} fetch error:`, fetchError);
      offset += batchSize;
      continue;
    }

    if (!products || products.length === 0) {
      break;
    }

    console.log(`[BulkEnrich] Processing batch ${progress.currentBatch}/${totalBatches} (${products.length} products)`);

    // Classify and update products in PARALLEL (10 at a time for speed)
    const parallelBatchSize = 10;
    for (let j = 0; j < products.length; j += parallelBatchSize) {
      const parallelBatch = products.slice(j, j + parallelBatchSize);

      const results = await Promise.all(
        parallelBatch.map(async (product) => {
          try {
            const componentType = await classifyProduct(
              product.product_name,
              product.brand,
              product.category_name
            );

            if (!dryRun) {
              const success = await updateProductComponentType(product.id, componentType);
              return { success, failed: !success };
            } else {
              console.log(`[DryRun] ${product.product_name} -> ${componentType}`);
              return { success: true, failed: false };
            }
          } catch (error) {
            console.error(`[BulkEnrich] Error classifying ${product.product_name}:`, error);
            return { success: false, failed: true };
          }
        })
      );

      // Aggregate results
      for (const result of results) {
        progress.processed++;
        if (result.success) progress.successful++;
        if (result.failed) progress.failed++;
      }
    }

    // Report progress
    if (onProgress) {
      onProgress({ ...progress });
    }

    console.log(`[BulkEnrich] Progress: ${progress.processed}/${total} (${Math.round(progress.processed / total * 100)}%)`);

    offset += batchSize;

    // Small delay between batches to avoid rate limits
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  console.log(`[BulkEnrich] Complete! Processed: ${progress.processed}, Success: ${progress.successful}, Failed: ${progress.failed}`);

  return progress;
}

/**
 * Re-enrich products that have component_type = 'other'
 * Useful for improving classification over time
 */
export async function reEnrichOtherProducts(
  options: {
    batchSize?: number;
    onProgress?: ProgressCallback;
  } = {}
): Promise<EnrichmentProgress> {
  const { batchSize = 50, onProgress } = options;
  const supabase = getSupabaseServer();

  // Count products marked as 'other'
  const { count } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true })
    .eq("component_type", "other")
    .eq("active", true);

  const total = count || 0;
  console.log(`[ReEnrich] Found ${total} products with 'other' type to re-classify`);

  // For now, just return - implementation similar to bulkEnrichProducts
  // but selects products WHERE component_type = 'other'
  return {
    total,
    processed: 0,
    successful: 0,
    failed: 0,
    currentBatch: 0,
    totalBatches: Math.ceil(total / batchSize),
  };
}

/**
 * Get enrichment statistics
 */
export async function getEnrichmentStats(): Promise<{
  total: number;
  enriched: number;
  pending: number;
  byType: Record<string, number>;
}> {
  const supabase = getSupabaseServer();

  // Get total active products
  const { count: total } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true })
    .eq("active", true);

  // Get products with component_type set
  const { count: enriched } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true })
    .eq("active", true)
    .not("component_type", "is", null);

  // Get counts by type - use RPC or paginate to avoid 1000 row limit
  const byType: Record<string, number> = {};

  // Fetch in chunks to get all enriched products
  let offset = 0;
  const chunkSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data: typeCounts } = await supabase
      .from("products")
      .select("component_type")
      .eq("active", true)
      .not("component_type", "is", null)
      .range(offset, offset + chunkSize - 1);

    if (typeCounts && typeCounts.length > 0) {
      for (const row of typeCounts) {
        const type = row.component_type || "unknown";
        byType[type] = (byType[type] || 0) + 1;
      }
      offset += chunkSize;
      hasMore = typeCounts.length === chunkSize;
    } else {
      hasMore = false;
    }
  }

  return {
    total: total || 0,
    enriched: enriched || 0,
    pending: (total || 0) - (enriched || 0),
    byType,
  };
}
