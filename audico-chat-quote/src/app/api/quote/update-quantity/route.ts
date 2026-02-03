import { NextRequest, NextResponse } from "next/server";
import { QuoteManager } from "@/lib/ai/quote-manager";

/**
 * Update Product Quantity Endpoint
 * Updates the quantity of a product in the quote
 */
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { quoteId, productId, quantity } = body;

    // Validate required parameters
    if (!quoteId || !productId) {
      return NextResponse.json(
        { error: "Missing quoteId or productId" },
        { status: 400 }
      );
    }

    if (typeof quantity !== "number" || quantity < 0) {
      return NextResponse.json(
        { error: "Invalid quantity (must be a non-negative number)" },
        { status: 400 }
      );
    }

    console.log(`[UpdateQuantity API] Updating product ${productId} in quote ${quoteId} to quantity ${quantity}`);

    const quoteManager = new QuoteManager();

    // If quantity is 0, remove the product
    if (quantity === 0) {
      // Get the quote to find the SKU
      const items = await quoteManager.getQuoteItems(quoteId);
      const item = items.find((i) => i.productId === productId);

      if (!item) {
        return NextResponse.json(
          { error: "Product not found in quote" },
          { status: 404 }
        );
      }

      await quoteManager.removeProduct(quoteId, item.product.sku);
      console.log(`[UpdateQuantity API] Quantity was 0 - removed product ${productId}`);
    } else {
      // Update the quantity
      await quoteManager.updateQuantity(quoteId, productId, quantity);
      console.log(`[UpdateQuantity API] Updated quantity successfully`);
    }

    // Get updated quote items to return
    const updatedItems = await quoteManager.getQuoteItems(quoteId);

    return NextResponse.json({
      success: true,
      quoteItems: updatedItems,
      message: quantity === 0
        ? "Product removed from quote"
        : `Quantity updated to ${quantity}`,
    });

  } catch (error: any) {
    console.error("[UpdateQuantity API] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update quantity" },
      { status: 500 }
    );
  }
}
