"use client";

import { formatCurrency } from "@/lib/utils";
import { Package, Check, Clock, SkipForward } from "lucide-react";
import type { Step, QuoteItem } from "@/lib/types";
import { cn } from "@/lib/utils";

interface QuoteSummaryProps {
  steps: Step[];
  selectedProducts: QuoteItem[];
  total: number;
}

export function QuoteSummary({
  steps,
  selectedProducts,
  total,
}: QuoteSummaryProps) {
  return (
    <div className="card space-y-6">
      <h3 className="text-lg font-semibold text-foreground">Quote Summary</h3>

      {/* Steps Progress */}
      <div className="space-y-3">
        {steps.map((step) => (
          <div
            key={step.id}
            className={cn(
              "flex items-center gap-3 p-3 rounded-lg",
              step.status === "completed" && "bg-success/10",
              step.status === "current" && "bg-accent/10 border border-accent/30",
              step.status === "skipped" && "bg-foreground-subtle/10",
              step.status === "pending" && "bg-background-elevated"
            )}
          >
            {/* Status Icon */}
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center",
                step.status === "completed" && "bg-success text-white",
                step.status === "current" && "bg-accent text-background",
                step.status === "skipped" && "bg-foreground-subtle text-background",
                step.status === "pending" && "bg-background-card border border-border"
              )}
            >
              {step.status === "completed" && <Check size={16} />}
              {step.status === "current" && <Clock size={16} />}
              {step.status === "skipped" && <SkipForward size={16} />}
              {step.status === "pending" && (
                <span className="text-xs text-foreground-muted">{step.id}</span>
              )}
            </div>

            {/* Step Info */}
            <div className="flex-1 min-w-0">
              <p
                className={cn(
                  "font-medium text-sm",
                  step.status === "pending" && "text-foreground-muted"
                )}
              >
                {step.label}
              </p>
              {step.selectedProduct && (
                <p className="text-xs text-foreground-muted truncate">
                  {step.selectedProduct.product.name}
                </p>
              )}
              {step.skippedReason && (
                <p className="text-xs text-foreground-subtle italic">
                  {step.skippedReason}
                </p>
              )}
            </div>

            {/* Price */}
            {step.selectedProduct && (
              <p className="text-sm font-semibold text-accent">
                {formatCurrency(step.selectedProduct.lineTotal)}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Total */}
      <div className="pt-4 border-t border-border">
        <div className="flex justify-between items-center">
          <span className="text-lg text-foreground">Total</span>
          <span className="text-2xl font-bold text-accent">
            {formatCurrency(total)}
          </span>
        </div>
        <p className="text-xs text-foreground-subtle mt-1">
          Including 15% VAT
        </p>
      </div>
    </div>
  );
}
