"use client";

import { useEffect, useState } from "react";
import { supabaseClient } from "@/lib/supabase";
import { Sidebar } from "@/components/layout/sidebar";
import { format } from "date-fns";
import { Loader2, FileText, ChevronRight, ShoppingCart, Calendar } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface QuoteSummary {
    id: string;
    created_at: string;
    updated_at: string;
    status: string;
    flow_type: string;
    selected_products: any[];
    total_price: number;
}

export default function QuotesPage() {
    const [quotes, setQuotes] = useState<QuoteSummary[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    useEffect(() => {
        // Get session ID from local storage
        const storedSessionId = localStorage.getItem("audico_session_id");
        setSessionId(storedSessionId);

        if (storedSessionId) {
            fetchQuotes(storedSessionId);
        } else {
            setIsLoading(false);
        }
    }, []);

    const fetchQuotes = async (sid: string) => {
        try {
            // Fetch quotes for this session
            const { data, error } = await supabaseClient
                .from("quotes")
                .select("*")
                .eq("session_id", sid)
                .order("created_at", { ascending: false });

            if (error) throw error;

            // Process quotes to calculate totals if not present
            const processedQuotes = (data || []).map((q: any) => {
                const items = q.selected_products || [];
                // Calculate total if not stored
                const total = items.reduce((sum: number, item: any) => {
                    return sum + (item.lineTotal || (item.price * item.quantity) || 0);
                }, 0);

                return {
                    id: q.id,
                    created_at: q.created_at,
                    updated_at: q.updated_at,
                    status: q.status || "draft",
                    flow_type: q.flow_type || "unknown",
                    selected_products: items,
                    total_price: total
                };
            });

            setQuotes(processedQuotes);
        } catch (error) {
            console.error("Error fetching quotes:", error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex h-screen overflow-hidden bg-background">
            <Sidebar
                collapsed={sidebarCollapsed}
                onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
            />

            <main className="flex-1 overflow-y-auto p-6 md:p-12">
                <div className="max-w-5xl mx-auto space-y-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                                Your Quotes
                            </h1>
                            <p className="text-muted-foreground mt-2">
                                Manage and resume your system designs and quotes
                            </p>
                        </div>
                    </div>

                    {!sessionId ? (
                        <div className="text-center py-20 bg-background-secondary rounded-xl border border-border">
                            <p className="text-muted-foreground">No session found. Start a chat to create a quote.</p>
                            <Link
                                href="/"
                                className="inline-block mt-4 px-6 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors"
                            >
                                Start New Chat
                            </Link>
                        </div>
                    ) : isLoading ? (
                        <div className="flex justify-center py-20">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : quotes.length === 0 ? (
                        <div className="text-center py-20 bg-background-secondary rounded-xl border border-border">
                            <div className="w-16 h-16 bg-background rounded-full flex items-center justify-center mx-auto mb-4 border border-border">
                                <FileText className="h-8 w-8 text-muted-foreground" />
                            </div>
                            <h2 className="text-xl font-semibold mb-2">No quotes yet</h2>
                            <p className="text-muted-foreground max-w-sm mx-auto mb-6">
                                You haven't generated any quotes in this session yet. Chat with our assistant to build your system.
                            </p>
                            <Link
                                href="/"
                                className="px-6 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors"
                            >
                                Create Quote
                            </Link>
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {quotes.map((quote) => (
                                <div
                                    key={quote.id}
                                    className="bg-background-secondary border border-border rounded-xl p-6 hover:border-primary/50 transition-colors group"
                                >
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-3">
                                                <span className={cn(
                                                    "px-2 py-1 rounded text-xs font-medium uppercase tracking-wider",
                                                    quote.status === 'complete' ? "bg-green-500/10 text-green-500" :
                                                        quote.status === 'in_progress' ? "bg-blue-500/10 text-blue-500" :
                                                            "bg-gray-500/10 text-gray-400"
                                                )}>
                                                    {quote.status.replace('_', ' ')}
                                                </span>
                                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                    <Calendar size={12} />
                                                    {format(new Date(quote.created_at), "MMM d, yyyy 'at' h:mm a")}
                                                </span>
                                            </div>
                                            <h3 className="text-lg font-semibold">
                                                {getQuoteTitle(quote)}
                                            </h3>
                                            <p className="text-sm text-muted-foreground">
                                                {quote.selected_products.length} item{quote.selected_products.length !== 1 ? 's' : ''} • Total: R {quote.total_price.toLocaleString()}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <Link
                                                href={`/pdf-viewer?id=${quote.id}`}
                                                className="px-4 py-2 text-sm font-medium bg-background border border-border hover:bg-muted rounded-lg transition-colors flex items-center gap-2"
                                            >
                                                View PDF
                                            </Link>
                                            {/* TODO: Add resume functionality by passing quoteId to chat */}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

function getQuoteTitle(quote: QuoteSummary): string {
    if (quote.flow_type === 'commercial_bgm') return 'Commercial Background Music System';
    if (quote.flow_type === 'home_cinema') return 'Home Cinema System';
    if (quote.flow_type === 'simple') return 'Quick Quote';
    return 'Custom System Design';
}
