"use client";

import { cn, formatCurrency } from "@/lib/utils";
import { ShoppingBag, Trash2, FileText, X, Plus, Minus, ExternalLink } from "lucide-react";
import type { QuoteItem } from "@/lib/types";
import { useState } from "react";
import { CustomerDetailsDialog } from "./customer-details-dialog";

interface QuoteSidebarProps {
  items: QuoteItem[];
  onRemove?: (productId: string) => void;
  onUpdateQuantity?: (productId: string, newQuantity: number) => void;
  onGenerateQuote?: (details?: any) => void;
}

export function QuoteSidebar({
  items,
  onRemove,
  onUpdateQuantity,
  onGenerateQuote,
}: QuoteSidebarProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const total = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const handleGenerateClick = () => {
    setShowDetailsDialog(true);
  };

  const handleDetailsConfirm = async (details: any) => {
    if (onGenerateQuote) {
      setIsGenerating(true);
      await onGenerateQuote(details);
      setIsGenerating(false);
      setShowDetailsDialog(false);
    }
  };

  if (!isExpanded) {
    // ... (rest of collapsed view)
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="fixed right-4 top-20 bg-accent text-background p-3 rounded-full shadow-lg hover:bg-accent-hover transition-colors z-50"
      >
        <ShoppingBag size={20} />
        {itemCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-background text-accent text-xs font-bold rounded-full flex items-center justify-center">
            {itemCount}
          </span>
        )}
      </button>
    );
  }

  return (
    <>
      {/* Mobile floating button */}
      <button
        onClick={() => setIsExpanded(false)}
        className="md:hidden fixed right-4 top-20 bg-accent text-background p-3 rounded-full shadow-lg hover:bg-accent-hover transition-colors z-50"
      >
        <ShoppingBag size={20} />
        {itemCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-background text-accent text-xs font-bold rounded-full flex items-center justify-center">
            {itemCount}
          </span>
        )}
      </button>

      {/* Full sidebar */}
      <aside className="hidden md:flex w-80 h-full bg-background-secondary border-l border-border flex-col">
        {/* Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-border">
          <div className="flex items-center gap-2">
            <ShoppingBag size={20} className="text-accent" />
            <h2 className="font-semibold text-foreground">Your Quote</h2>
            {itemCount > 0 && (
              <span className="bg-accent text-background text-xs font-bold px-2 py-0.5 rounded-full">
                {itemCount}
              </span>
            )}
          </div>
          <button
            onClick={() => setIsExpanded(false)}
            className="p-1.5 hover:bg-background-elevated rounded-lg transition-colors"
          >
            <X size={18} className="text-foreground-muted" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <div className="text-center py-12 text-foreground-muted">
              <ShoppingBag size={48} className="mx-auto mb-4 opacity-30" />
              <p>Your quote is empty</p>
              <p className="text-sm mt-1">Select products to add them here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.productId}
                  className="bg-background-card border border-border rounded-lg p-3"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-foreground text-sm line-clamp-2">
                        {item.product.name}
                      </h4>
                      <p className="text-xs text-foreground-muted mt-1">
                        {item.product.brand}
                      </p>
                    </div>
                    <div className="flex items-center">
                      <a
                        href={item.product.opencartProductId
                          ? `https://www.audicoonline.co.za/index.php?route=checkout/cart/add&product_id=${item.product.opencartProductId}`
                          : `https://www.audicoonline.co.za/index.php?route=product/search&search=${encodeURIComponent(item.product.sku)}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 hover:bg-accent/20 rounded-lg transition-colors group mr-1"
                        title={item.product.opencartProductId ? "Add to Cart on Audico Online" : "Search on Audico Online"}
                      >
                        <ExternalLink
                          size={14}
                          className="text-foreground-muted group-hover:text-accent"
                        />
                      </a>
                      {onRemove && (
                        <button
                          onClick={() => onRemove(item.productId)}
                          className="p-1.5 hover:bg-error/20 rounded-lg transition-colors group"
                        >
                          <Trash2
                            size={14}
                            className="text-foreground-muted group-hover:text-error"
                          />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Quantity Controls */}
                  <div className="flex items-center justify-between mt-2">
                    {onUpdateQuantity ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            const newQty = item.quantity - 1;
                            if (newQty > 0) {
                              onUpdateQuantity(item.productId, newQty);
                            } else if (onRemove) {
                              onRemove(item.productId);
                            }
                          }}
                          className="p-1 hover:bg-background-elevated rounded transition-colors"
                          title="Decrease quantity"
                        >
                          <Minus size={14} className="text-foreground-muted" />
                        </button>
                        <span className="text-sm font-medium text-foreground w-8 text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => onUpdateQuantity(item.productId, item.quantity + 1)}
                          className="p-1 hover:bg-background-elevated rounded transition-colors"
                          title="Increase quantity"
                        >
                          <Plus size={14} className="text-foreground-muted" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-foreground-muted">
                        Qty: {item.quantity}
                      </span>
                    )}
                    <p className="text-sm font-semibold text-accent">
                      {formatCurrency(item.lineTotal)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="p-4 border-t border-border space-y-4">
            {/* Total */}
            <div className="flex justify-between items-center">
              <span className="text-foreground-muted">Total</span>
              <span className="text-2xl font-bold text-foreground">
                {formatCurrency(total)}
              </span>
            </div>

            {/* VAT Note */}
            <p className="text-xs text-foreground-subtle text-center">
              Prices include 15% VAT
            </p>

            {/* Generate Quote Button */}
            <button
              onClick={handleGenerateClick}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <FileText size={18} />
              <span>Generate Quote</span>
            </button>
          </div>
        )}
      </aside>

      {/* Customer Details Dialog */}
      <CustomerDetailsDialog
        isOpen={showDetailsDialog}
        onClose={() => setShowDetailsDialog(false)}
        onConfirm={handleDetailsConfirm}
        isLoading={isGenerating}
      />
    </>
  );
}
