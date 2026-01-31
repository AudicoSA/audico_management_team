import { NextRequest, NextResponse } from "next/server";
import { bulkEnrichProducts, getEnrichmentStats } from "@/lib/enrichment/bulk-enrich";
import { classifyAndUpdateProduct } from "@/lib/enrichment/classifier";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/enrich
 * Get enrichment statistics
 */
export async function GET() {
  try {
    const stats = await getEnrichmentStats();
    return NextResponse.json(stats);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/admin/enrich
 * Start bulk enrichment or classify a single product
 *
 * For bulk enrichment:
 * { "action": "bulk", "batchSize": 50 }
 *
 * For single product (webhook from product feed):
 * { "action": "single", "productId": "xxx", "productName": "...", "brand": "...", "category": "..." }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === "bulk") {
      const { batchSize = 50, dryRun = false } = body;

      console.log(`[Enrich API] Starting bulk enrichment (batchSize: ${batchSize}, dryRun: ${dryRun})`);

      // Run enrichment
      const result = await bulkEnrichProducts({
        batchSize,
        dryRun,
        onProgress: (progress) => {
          console.log(`[Enrich API] Progress: ${progress.processed}/${progress.total}`);
        },
      });

      return NextResponse.json({
        success: true,
        message: `Enrichment complete`,
        result,
      });
    }

    if (action === "single") {
      const { productId, productName, brand, category } = body;

      if (!productId || !productName) {
        return NextResponse.json(
          { error: "productId and productName are required" },
          { status: 400 }
        );
      }

      console.log(`[Enrich API] Classifying single product: ${productName}`);

      const componentType = await classifyAndUpdateProduct(
        productId,
        productName,
        brand,
        category
      );

      return NextResponse.json({
        success: true,
        productId,
        componentType,
      });
    }

    return NextResponse.json(
      { error: "Invalid action. Use 'bulk' or 'single'" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("[Enrich API] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
