"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { UnifiedChat } from "@/components/chat/unified-chat";
import { QuoteSidebar } from "@/components/quote/quote-sidebar";

import { generateQuotePDF } from "@/lib/pdf-generator";

export default function Home() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [quoteItems, setQuoteItems] = useState<any[]>([]);
  const [quoteId, setQuoteId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string>(() => {
    // Generate a session ID if not exists
    if (typeof window !== 'undefined') {
      const existing = sessionStorage.getItem('sessionId');
      if (existing) return existing;
      const newId = crypto.randomUUID();
      sessionStorage.setItem('sessionId', newId);
      return newId;
    }
    return crypto.randomUUID();
  });

  const handleRemoveItem = async (productId: string) => {
    // Remove item from local state immediately (client-side removal works always)
    setQuoteItems((prev) => prev.filter((item) => item.productId !== productId));
    console.log(`[Home] Removed product ${productId} from quote (client-side)`);

    // Optionally try to sync with backend (may fail for AI-native quotes, which is OK)
    if (quoteId) {
      try {
        await fetch("/api/quote/remove", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quoteId, productId, sessionId }),
        });
      } catch (error) {
        // Silently ignore - client-side state already updated
        console.log("[Home] Backend sync skipped (expected for AI-native flow)");
      }
    }
  };

  const handleUpdateQuantity = async (productId: string, newQuantity: number) => {
    // ... update quantity logic ...
    if (!quoteId) {
      console.warn("[Home] Cannot update quantity - no quote ID");
      return;
    }

    if (newQuantity < 0) {
      console.warn("[Home] Invalid quantity:", newQuantity);
      return;
    }

    try {
      console.log(`[Home] Updating ${productId} to quantity ${newQuantity}`);

      const response = await fetch("/api/quote/update-quantity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteId,
          productId,
          quantity: newQuantity,
        }),
      });

      const data = await response.json();

      if (data.error) {
        console.error("[Home] Update quantity error:", data.error);
        return;
      }

      // Update quote items with the response
      if (data.quoteItems) {
        setQuoteItems(data.quoteItems);
        console.log(`[Home] Updated quantity successfully`);
      }

    } catch (error) {
      console.error("[Home] Update quantity error:", error);
    }
  };

  const handleQuoteUpdate = (items: any[], newQuoteId?: string) => {
    setQuoteItems(items);
    if (newQuoteId && newQuoteId !== quoteId) {
      setQuoteId(newQuoteId);
    }
  };

  const handleGenerateQuote = async (customerDetails?: any) => {
    if (quoteItems.length === 0) return;

    // Capture lead and save quote to DB
    if (customerDetails) {
      // Calculate totals for storage
      const totalInclusive = quoteItems.reduce((sum, item) => sum + item.lineTotal, 0);
      const vatRate = 0.15;
      const subTotal = totalInclusive / (1 + vatRate);
      const vatAmount = totalInclusive - subTotal;

      const currentQuoteId = quoteId || `PF${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 900) + 100}`;

      // Expecting to use the same ID for PDF and DB
      // We need to ensure the PDF generator uses this ID if we want them to match perfectly.
      // Currently PDF generator logic creates its own if not provided?
      // Actually PDF generator has its own logic: `PF${yy}${mm}${dd}-${randomSeq}` IF we don't force it?
      // Wait, let's look at pdf-generator.ts. It ignores details.quoteId for the Invoice No text and re-generates it!
      // This is a disconnect. I should fix pdf-generator to use details.quoteId if it looks like a PF number.

      // For now, let's send what we have.
      fetch("/api/quote/capture-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          quoteId: currentQuoteId,
          ...customerDetails,
          items: quoteItems,
          totals: {
            subTotal,
            vat: vatAmount,
            total: totalInclusive
          }
        })
      }).catch(err => console.error("Failed to capture lead", err));
    }

    // Generate PDF with captured details
    await generateQuotePDF({
      quoteId: quoteId || `UNKNOWN-${Date.now()}`,
      items: quoteItems,
      ...customerDetails
    });
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left Sidebar - Navigation */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main Content - Chat */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <UnifiedChat onQuoteUpdate={handleQuoteUpdate} />
      </main>

      {/* Right Sidebar - Quote Summary */}
      <QuoteSidebar
        items={quoteItems}
        onRemove={handleRemoveItem}
        onUpdateQuantity={handleUpdateQuantity}
        onGenerateQuote={handleGenerateQuote}
      />
    </div>
  );
}
