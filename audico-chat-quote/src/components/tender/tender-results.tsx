"use client";

import { cn, formatCurrency } from "@/lib/utils";
import { Check, AlertTriangle, X, Package, Plus, ChevronDown, ChevronUp } from "lucide-react";
import type { Product } from "@/lib/types";
import { useState } from "react";

interface ExtractedItem {
    quantity: number;
    description: string;
    brand: string | null;
    model: string | null;
    specifications: Record<string, any>;
    category: string;
}

interface MatchResult {
    extractedItem: ExtractedItem;
    matches: {
        product: Product;
        confidence: "high" | "medium" | "low";
        matchReason: string;
    }[];
    status: "matched" | "partial" | "unmatched";
}

interface TenderResultsProps {
    results: MatchResult[];
    summary: {
        total: number;
        matched: number;
        partial: number;
        unmatched: number;
    };
    onAddToQuote: (product: Product, quantity: number) => void;
    disabled?: boolean;
}

export function TenderResults({
    results,
    summary,
    onAddToQuote,
    disabled = false
}: TenderResultsProps) {
    const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

    const toggleExpanded = (index: number) => {
        const newExpanded = new Set(expandedItems);
        if (newExpanded.has(index)) {
            newExpanded.delete(index);
        } else {
            newExpanded.add(index);
        }
        setExpandedItems(newExpanded);
    };

    return (
        <div className="space-y-4">
            {/* Summary Header */}
            <div className="bg-background-card border border-border rounded-xl p-4">
                <h3 className="font-semibold text-foreground mb-3">Tender Analysis Complete</h3>
                <div className="grid grid-cols-4 gap-2 text-center text-sm">
                    <div className="p-2 bg-background-elevated rounded-lg">
                        <div className="text-lg font-bold text-foreground">{summary.total}</div>
                        <div className="text-foreground-muted text-xs">Total Items</div>
                    </div>
                    <div className="p-2 bg-success/10 rounded-lg">
                        <div className="text-lg font-bold text-success">{summary.matched}</div>
                        <div className="text-success text-xs">Matched</div>
                    </div>
                    <div className="p-2 bg-warning/10 rounded-lg">
                        <div className="text-lg font-bold text-warning">{summary.partial}</div>
                        <div className="text-warning text-xs">Review</div>
                    </div>
                    <div className="p-2 bg-error/10 rounded-lg">
                        <div className="text-lg font-bold text-error">{summary.unmatched}</div>
                        <div className="text-error text-xs">Not Found</div>
                    </div>
                </div>
            </div>

            {/* Results List */}
            <div className="space-y-3">
                {results.map((result, index) => (
                    <ResultCard
                        key={index}
                        result={result}
                        index={index}
                        isExpanded={expandedItems.has(index)}
                        onToggle={() => toggleExpanded(index)}
                        onAddToQuote={onAddToQuote}
                        disabled={disabled}
                    />
                ))}
            </div>
        </div>
    );
}

interface ResultCardProps {
    result: MatchResult;
    index: number;
    isExpanded: boolean;
    onToggle: () => void;
    onAddToQuote: (product: Product, quantity: number) => void;
    disabled: boolean;
}

function ResultCard({ result, index, isExpanded, onToggle, onAddToQuote, disabled }: ResultCardProps) {
    const { extractedItem, matches, status } = result;

    const statusConfig = {
        matched: {
            icon: Check,
            bgColor: "bg-success/10",
            borderColor: "border-success/30",
            iconColor: "text-success",
            label: "Matched",
        },
        partial: {
            icon: AlertTriangle,
            bgColor: "bg-warning/10",
            borderColor: "border-warning/30",
            iconColor: "text-warning",
            label: "Review Needed",
        },
        unmatched: {
            icon: X,
            bgColor: "bg-error/10",
            borderColor: "border-error/30",
            iconColor: "text-error",
            label: "Not Found",
        },
    };

    const config = statusConfig[status];
    const StatusIcon = config.icon;

    return (
        <div className={cn(
            "border rounded-xl overflow-hidden transition-all",
            config.borderColor,
            config.bgColor
        )}>
            {/* Header */}
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between p-3 text-left hover:bg-black/10 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center",
                        status === "matched" && "bg-success",
                        status === "partial" && "bg-warning",
                        status === "unmatched" && "bg-error"
                    )}>
                        <StatusIcon size={16} className="text-background" />
                    </div>
                    <div>
                        <div className="font-medium text-foreground">
                            {extractedItem.quantity}x {extractedItem.brand || ""} {extractedItem.description}
                        </div>
                        <div className="text-xs text-foreground-muted">
                            {extractedItem.model && `Model: ${extractedItem.model} • `}
                            {config.label}
                            {matches.length > 0 && ` • ${matches.length} option${matches.length > 1 ? "s" : ""}`}
                        </div>
                    </div>
                </div>
                {matches.length > 0 && (
                    isExpanded ? <ChevronUp size={18} className="text-foreground-muted" /> : <ChevronDown size={18} className="text-foreground-muted" />
                )}
            </button>

            {/* Expanded Content */}
            {isExpanded && matches.length > 0 && (
                <div className="px-3 pb-3 space-y-2">
                    {matches.map((match, matchIndex) => (
                        <div
                            key={matchIndex}
                            className="bg-background-card border border-border rounded-lg p-3 flex items-center justify-between gap-3"
                        >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="w-12 h-12 bg-background-elevated rounded-lg flex items-center justify-center flex-shrink-0">
                                    <Package size={20} className="text-foreground-subtle" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-foreground text-sm line-clamp-1">
                                        {match.product.name}
                                    </div>
                                    <div className="text-xs text-foreground-muted">
                                        {match.product.brand} • {match.product.sku}
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className={cn(
                                            "text-xs px-1.5 py-0.5 rounded",
                                            match.confidence === "high" && "bg-success/20 text-success",
                                            match.confidence === "medium" && "bg-warning/20 text-warning",
                                            match.confidence === "low" && "bg-foreground-muted/20 text-foreground-muted"
                                        )}>
                                            {match.confidence} confidence
                                        </span>
                                        <span className="text-xs text-foreground-subtle">{match.matchReason}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                                <div className="font-semibold text-accent">
                                    {formatCurrency(match.product.price)}
                                </div>
                                <button
                                    onClick={() => onAddToQuote(match.product, extractedItem.quantity)}
                                    disabled={disabled}
                                    className={cn(
                                        "mt-1 text-xs bg-accent text-background px-2 py-1 rounded flex items-center gap-1",
                                        disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-accent-hover"
                                    )}
                                >
                                    <Plus size={12} />
                                    Add {extractedItem.quantity}x
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Unmatched Message */}
            {status === "unmatched" && (
                <div className="px-3 pb-3">
                    <div className="bg-error/5 border border-error/20 rounded-lg p-3 text-sm text-error">
                        <p className="font-medium">Product not found in catalog</p>
                        <p className="text-xs mt-1 text-error/70">
                            This item has been flagged for our team to review for future sourcing.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
