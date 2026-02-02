"use client";

import { useEffect, useState } from "react";
import { supabaseClient } from "@/lib/supabase";
import { Sidebar } from "@/components/layout/sidebar";
import { format } from "date-fns";
import { Loader2, MessageSquare, User, Bot, Clock } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface ChatMessage {
    id: string;
    role: string;
    content: any;
    created_at: string;
    message_index: number;
}

export default function HistoryPage() {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    useEffect(() => {
        const storedSessionId = localStorage.getItem("audico_session_id");
        setSessionId(storedSessionId);

        if (storedSessionId) {
            fetchHistory(storedSessionId);
        } else {
            setIsLoading(false);
        }
    }, []);

    const fetchHistory = async (sid: string) => {
        try {
            const { data, error } = await supabaseClient
                .from("conversation_history")
                .select("*")
                .eq("session_id", sid)
                .order("message_index", { ascending: true });

            if (error) throw error;
            setMessages(data || []);
        } catch (error) {
            console.error("Error fetching history:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const renderContent = (content: any) => {
        if (typeof content === 'string') return content;

        // Handle Claude content blocks
        if (Array.isArray(content)) {
            return content.map((block, i) => {
                if (block.type === 'text') return block.text;
                if (block.type === 'tool_use') return `[Using Tool: ${block.name}]`;
                if (block.type === 'tool_result') return `[Tool Result]`;
                return '';
            }).join('\n');
        }

        return JSON.stringify(content);
    };

    return (
        <div className="flex h-screen overflow-hidden bg-background">
            <Sidebar
                collapsed={sidebarCollapsed}
                onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
            />

            <main className="flex-1 overflow-y-auto p-6 md:p-12">
                <div className="max-w-4xl mx-auto space-y-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                                Chat History
                            </h1>
                            <p className="text-muted-foreground mt-2">
                                Transcript of your conversation with the assistant
                            </p>
                        </div>
                        <div className="text-sm text-muted-foreground">
                            Session ID: <span className="font-mono text-xs">{sessionId?.substring(0, 8)}...</span>
                        </div>
                    </div>

                    {!sessionId ? (
                        <div className="text-center py-20 bg-background-secondary rounded-xl border border-border">
                            <p className="text-muted-foreground">No session found.</p>
                        </div>
                    ) : isLoading ? (
                        <div className="flex justify-center py-20">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="text-center py-20 bg-background-secondary rounded-xl border border-border">
                            <div className="w-16 h-16 bg-background rounded-full flex items-center justify-center mx-auto mb-4 border border-border">
                                <MessageSquare className="h-8 w-8 text-muted-foreground" />
                            </div>
                            <h2 className="text-xl font-semibold mb-2">No history yet</h2>
                            <p className="text-muted-foreground max-w-sm mx-auto mb-6">
                                Start chatting to build up your history.
                            </p>
                            <Link
                                href="/"
                                className="px-6 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors"
                            >
                                Start Chat
                            </Link>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={cn(
                                        "flex gap-4 p-4 rounded-xl border",
                                        msg.role === 'user'
                                            ? "bg-primary/5 border-primary/20 ml-12"
                                            : "bg-background-secondary border-border mr-12"
                                    )}
                                >
                                    <div className={cn(
                                        "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                                        msg.role === 'user' ? "bg-primary/20 text-primary" : "bg-blue-500/20 text-blue-500"
                                    )}>
                                        {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                                    </div>

                                    <div className="flex-1 space-y-1">
                                        <div className="flex items-center justify-between pb-1">
                                            <span className="text-sm font-semibold capitalize">{msg.role === 'assistant' ? 'Audico AI' : 'You'}</span>
                                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                <Clock size={10} />
                                                {format(new Date(msg.created_at), "h:mm a • MMM d")}
                                            </span>
                                        </div>

                                        <div className="text-sm rounded-md whitespace-pre-wrap font-mono text-xs md:text-sm text-foreground/80">
                                            {renderContent(msg.content)}
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
