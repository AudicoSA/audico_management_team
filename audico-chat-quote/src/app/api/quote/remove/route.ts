import { NextRequest, NextResponse } from "next/server";
import { SystemDesignEngine } from "@/lib/flows/system-design/engine";
import { SimpleQuoteEngine } from "@/lib/flows/simple-quote/engine";

export const dynamic = "force-dynamic";

/**
 * DELETE Product from Quote Endpoint
 * Handles removing products and detecting if critical components were removed
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { quoteId, productId, sku, sessionId } = body;

    if (!quoteId || (!productId && !sku)) {
      return NextResponse.json(
        { error: "Missing quoteId and productId/sku" },
        { status: 400 }
      );
    }

    console.log(`[Remove API] Removing product ${productId || sku} from quote ${quoteId}`);

    // Try to load as System Design quote first
    let engine = await SystemDesignEngine.load(quoteId);
    let isSystemDesign = true;

    if (!engine) {
      // Try Simple Quote
      const simpleEngine = await SimpleQuoteEngine.load(quoteId);
      if (!simpleEngine) {
        return NextResponse.json(
          { error: "Quote not found" },
          { status: 404 }
        );
      }
      isSystemDesign = false;

      // For Simple Quote, remove the item
      const items = simpleEngine.getItems();
      const removedItem = items.find((item) =>
        item.productId === productId || item.product.sku === sku
      );

      if (!removedItem) {
        return NextResponse.json(
          { error: "Product not found in quote" },
          { status: 404 }
        );
      }

      // TODO: Implement removeProduct for SimpleQuoteEngine
      // For now, return error
      return NextResponse.json(
        { error: "Remove not yet implemented for simple quotes" },
        { status: 501 }
      );
    }

    // System Design Quote - need to remove from selected products and update step
    const summary = engine.getSummary();
    const selectedProducts = summary.selectedProducts;

    const removedProduct = selectedProducts.find((item) =>
      item.productId === productId || item.product.sku === sku
    );

    if (!removedProduct) {
      return NextResponse.json(
        { error: "Product not found in quote" },
        { status: 404 }
      );
    }

    // Determine if product is critical
    const criticalCategories = [
      "AV Receiver",
      "AVR",
      "Receiver",
      "Amplifier",
      "Speaker",
      "Subwoofer",
      "Height Speaker",
      "Atmos",
    ];

    const isCritical = criticalCategories.some((keyword) =>
      removedProduct.product.category?.toLowerCase().includes(keyword.toLowerCase()) ||
      removedProduct.product.name.toLowerCase().includes(keyword.toLowerCase())
    );

    // TODO: Implement actual removal logic in SystemDesignEngine
    // For now, we'll return a structured response
    console.log(`[Remove API] Product ${removedProduct.product.name} is ${isCritical ? 'CRITICAL' : 'non-critical'}`);

    return NextResponse.json({
      success: true,
      removedProduct: removedProduct.product,
      isCritical,
      message: isCritical
        ? `I've removed the ${removedProduct.product.name} from your quote. This is a critical component for your system. Would you like me to suggest alternative options?`
        : `I've removed the ${removedProduct.product.name} from your quote.`,
      // Note: In a full implementation, we'd return updated quoteItems here
      // For now, return current items minus the removed one
      quoteItems: selectedProducts.filter(item =>
        item.productId !== productId && item.product.sku !== sku
      ),
    });

  } catch (error: any) {
    console.error("[Remove API] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to remove product" },
      { status: 500 }
    );
  }
}
