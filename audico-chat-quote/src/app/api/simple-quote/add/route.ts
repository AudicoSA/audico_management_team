import { NextRequest, NextResponse } from "next/server";
import { SimpleQuoteEngine } from "@/lib/flows/simple-quote/engine";
import { getSupabaseServer } from "@/lib/supabase";
import type { Product } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { quoteId, productId, product: providedProduct, quantity = 1 } = body;

    if (!quoteId) {
      return NextResponse.json(
        { error: "quoteId is required" },
        { status: 400 }
      );
    }

    if (!productId && !providedProduct) {
      return NextResponse.json(
        { error: "productId or product is required" },
        { status: 400 }
      );
    }

    // Load the quote
    const engine = await SimpleQuoteEngine.load(quoteId);
    if (!engine) {
      return NextResponse.json(
        { error: "Quote not found" },
        { status: 404 }
      );
    }

    // Get the product
    let product: Product;
    if (providedProduct) {
      product = providedProduct;
    } else {
      // Look up product from database
      const supabase = getSupabaseServer();
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", productId)
        .single();

      if (error || !data) {
        return NextResponse.json(
          { error: "Product not found" },
          { status: 404 }
        );
      }

      product = {
        id: data.id,
        name: data.product_name,
        sku: data.sku,
        model: data.model,
        brand: data.brand,
        category: data.category_name,
        price: parseFloat(String(data.retail_price || 0)),
        cost: parseFloat(String(data.cost_price || 0)),
        stock: {
          total: (data.stock_jhb || 0) + (data.stock_cpt || 0) + (data.stock_dbn || 0),
          jhb: data.stock_jhb || 0,
          cpt: data.stock_cpt || 0,
          dbn: data.stock_dbn || 0,
        },
        images: data.images || [],
        specifications: data.specifications || {},
        useCase: data.use_case,
      };
    }

    // Add the product
    const item = await engine.addItem(product, quantity);
    const summary = engine.getSummary();

    return NextResponse.json({
      success: true,
      item,
      quoteTotal: summary.total,
      itemCount: summary.itemCount,
      quoteItems: summary.items,
      message: `Added ${product.name} to your quote. Total: R ${summary.total.toLocaleString()}`,
    });
  } catch (error: any) {
    console.error("Simple Quote Add API error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to add product" },
      { status: 500 }
    );
  }
}
