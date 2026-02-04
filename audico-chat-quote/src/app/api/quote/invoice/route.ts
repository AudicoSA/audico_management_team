import { NextRequest, NextResponse } from "next/server";
import { QuoteManager } from "@/lib/ai/quote-manager";

export const dynamic = "force-dynamic";

/**
 * GET /api/quote/invoice?quote_id=xxx
 * Get or generate invoice number for a quote
 * Used before PDF download to ensure consistent invoice numbers
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const quoteId = searchParams.get("quote_id");

    if (!quoteId) {
      return NextResponse.json(
        { error: "Missing quote_id parameter" },
        { status: 400 }
      );
    }

    const quoteManager = new QuoteManager();
    const invoiceNumber = await quoteManager.getInvoiceNumber(quoteId);

    return NextResponse.json({
      quote_id: quoteId,
      invoice_number: invoiceNumber,
    });
  } catch (error: any) {
    console.error("[Invoice API] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get invoice number" },
      { status: 500 }
    );
  }
}
