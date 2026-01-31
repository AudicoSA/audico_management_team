import { NextRequest, NextResponse } from "next/server";
import { quoteManager } from "@/lib/quote-manager";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      customerName, customerEmail, customerPhone, companyName,
      quoteId, items, totals, sessionId,
      customerAddress, vatNumber
    } = body;

    // For now, we'll just log this to the console.
    // In a future update, we'll insert into a 'leads' or 'consultation_requests' table.
    console.log("----------------------------------------");
    console.log("📝 LEAD & QUOTE CAPTURED");
    console.log(`Name: ${customerName}`);
    console.log(`Email: ${customerEmail}`);
    console.log(`Company: ${companyName || 'N/A'}`);
    console.log(`Phone: ${customerPhone || 'N/A'}`);
    console.log(`Quote ID: ${quoteId}`);
    console.log("----------------------------------------");

    // Save to DB via QuoteManager
    if (quoteId && items) {
      await quoteManager.saveQuote({
        quote_id: quoteId,
        session_id: sessionId,
        customer_details: {
          customerName, customerEmail, customerPhone, companyName, customerAddress, vatNumber
        },
        items: items,
        totals: totals || { subTotal: 0, vat: 0, total: 0 }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error capturing lead:", error);
    return NextResponse.json({ success: false, error: "Failed to capture lead" }, { status: 500 });
  }
}
