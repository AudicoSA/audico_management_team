"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Search, Filter, FileText, ChevronDown, ChevronUp, Package } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuoteListProps {
    quotes: any[];
}

export function QuotesList({ quotes: initialQuotes }: QuoteListProps) {
    const [quotes, setQuotes] = useState(initialQuotes);
    const [searchTerm, setSearchTerm] = useState("");
    const [expandedId, setExpandedId] = useState<string | null>(null);

    // Transcript state: sessionId -> messages[]
    const [transcript, setTranscript] = useState<Record<string, any[]>>({});
    const [loadingTranscript, setLoadingTranscript] = useState<string | null>(null);

    const filteredQuotes = quotes.filter((q) =>
        q.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (q.session_id && q.session_id.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const toggleExpand = (id: string) => {
        setExpandedId(expandedId === id ? null : id);
    };

    const fetchTranscript = async (sessionId: string) => {
        if (transcript[sessionId]) return; // Already loaded

        setLoadingTranscript(sessionId);
        try {
            const res = await fetch(`/api/admin/history?session_id=${sessionId}`);
            const data = await res.json();
            if (res.ok) {
                setTranscript(prev => ({ ...prev, [sessionId]: data.messages }));
            }
        } catch (error) {
            console.error("Failed to fetch transcript", error);
        } finally {
            setLoadingTranscript(null);
        }
    };

    const renderContent = (content: any) => {
        if (typeof content === 'string') return content;
        if (Array.isArray(content)) {
            return content.map((block) => {
                if (block.type === 'text') return block.text;
                if (block.type === 'tool_use') return `[Tool: ${block.name}]`;
                if (block.type === 'tool_result') return `[Result]`;
                return '';
            }).join('\n');
        }
        return JSON.stringify(content);
    };

    const calculateTotal = (products: any[]) => {
        if (!products) return 0;
        return products.reduce((sum, item) => {
            // Handle implicit "quantity" if missing (default 1)
            const qty = item.quantity || 1;
            // Handle "price" or "retail_price"
            const price = item.price || item.retail_price || 0;
            // Or if item has lineTotal pre-calculated
            if (item.lineTotal) return sum + item.lineTotal;
            return sum + (price * qty);
        }, 0);
    };

    return (
        <div className="space-y-6">
            <div className="flex gap-4 mb-6">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search by Quote ID or Session ID..."
                        className="w-full pl-10 pr-4 py-2 bg-background-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="bg-background-secondary border border-border rounded-xl overflow-hidden">
                <div className="grid grid-cols-12 gap-4 p-4 border-b border-border bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <div className="col-span-3">Created</div>
                    <div className="col-span-4">ID / Type</div>
                    <div className="col-span-2 text-right">Items</div>
                    <div className="col-span-2 text-right">Total</div>
                    <div className="col-span-1"></div>
                </div>

                {filteredQuotes.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                        No quotes found.
                    </div>
                ) : (
                    filteredQuotes.map((quote) => {
                        const total = calculateTotal(quote.selected_products);
                        const isExpanded = expandedId === quote.id;
                        const hasTranscript = !!transcript[quote.session_id];

                        return (
                            <div key={quote.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                                <div
                                    className="grid grid-cols-12 gap-4 p-4 items-center cursor-pointer"
                                    onClick={() => toggleExpand(quote.id)}
                                >
                                    <div className="col-span-3 text-sm">
                                        <div className="font-medium text-foreground">
                                            {format(new Date(quote.created_at), "MMM d, yyyy")}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {format(new Date(quote.created_at), "h:mm a")}
                                        </div>
                                    </div>

                                    <div className="col-span-4">
                                        <div className="text-xs font-mono text-muted-foreground mb-1 truncate" title={quote.id}>
                                            {quote.id.substring(0, 8)}...
                                        </div>
                                        <span className={cn(
                                            "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize",
                                            quote.flow_type === 'simple' ? "bg-blue-500/10 text-blue-500" :
                                                quote.flow_type === 'home_cinema' ? "bg-purple-500/10 text-purple-500" :
                                                    "bg-gray-500/10 text-gray-500"
                                        )}>
                                            {quote.flow_type?.replace('_', ' ') || 'Unknown'}
                                        </span>
                                    </div>

                                    <div className="col-span-2 text-right text-sm">
                                        {quote.selected_products?.length || 0}
                                    </div>

                                    <div className="col-span-2 text-right font-medium text-sm">
                                        R {total.toLocaleString()}
                                    </div>

                                    <div className="col-span-1 flex justify-end">
                                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="p-4 bg-background/50 border-t border-border">
                                        <div className="grid md:grid-cols-2 gap-6">
                                            {/* LEFT COLUMN: PRODUCTS */}
                                            <div>
                                                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                                    <Package size={16} />
                                                    Products Selected
                                                </h4>
                                                <div className="space-y-2">
                                                    {quote.selected_products?.map((item: any, i: number) => (
                                                        <div key={i} className="flex justify-between items-center text-sm p-2 bg-background rounded border border-border">
                                                            <div className="flex items-center gap-3">
                                                                {item.product?.images?.[0] && (
                                                                    <img src={item.product?.images?.[0]} className="w-8 h-8 object-contain rounded bg-white" alt="" />
                                                                )}
                                                                <div>
                                                                    <div className="font-medium">{item.product?.name || item.sku}</div>
                                                                    <div className="text-xs text-muted-foreground">Qty: {item.quantity || 1} • SKU: {item.sku}</div>
                                                                </div>
                                                            </div>
                                                            <div className="font-mono">
                                                                R {((item.lineTotal) || ((item.price || 0) * (item.quantity || 1))).toLocaleString()}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* RIGHT COLUMN: CHAT HISTORY */}
                                            <div>
                                                <div className="flex items-center justify-between mb-3">
                                                    <h4 className="text-sm font-semibold flex items-center gap-2">
                                                        <FileText size={16} />
                                                        Chat Context
                                                    </h4>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            fetchTranscript(quote.session_id);
                                                        }}
                                                        className="text-xs px-2 py-1 bg-primary/10 text-primary rounded hover:bg-primary/20"
                                                        disabled={loadingTranscript === quote.session_id || hasTranscript}
                                                    >
                                                        {loadingTranscript === quote.session_id ? "Loading..." : hasTranscript ? "Refetch" : "Load History"}
                                                    </button>
                                                </div>

                                                <div className="bg-background rounded border border-border p-3 h-[300px] overflow-y-auto text-xs space-y-3">
                                                    {hasTranscript ? (
                                                        transcript[quote.session_id]?.length === 0 ? (
                                                            <div className="text-center text-muted-foreground py-10 opacity-70">
                                                                No chat history found for this session.
                                                            </div>
                                                        ) : (
                                                            transcript[quote.session_id]?.map((msg: any) => (
                                                                <div key={msg.id} className={cn("p-2 rounded", msg.role === 'user' ? "bg-muted/50 ml-4" : "bg-primary/5 mr-4")}>
                                                                    <div className="font-semibold mb-1 opacity-70 flex items-center justify-between">
                                                                        <span>{msg.role === 'user' ? "User" : "AI"}</span>
                                                                        <span className="text-[10px]">{format(new Date(msg.created_at), "h:mm a")}</span>
                                                                    </div>
                                                                    <div className="whitespace-pre-wrap">{renderContent(msg.content)}</div>
                                                                </div>
                                                            ))
                                                        )
                                                    ) : (
                                                        <div className="text-center text-muted-foreground py-10 opacity-50">
                                                            Click "Load History" to view the conversation.
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-4 pt-4 border-t border-border flex justify-between items-center">
                                            <div className="text-xs text-muted-foreground">
                                                Session ID: <span className="font-mono select-all bg-muted px-1 rounded">{quote.session_id}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
