"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
    role: "user" | "assistant";
    content: string;
}

export default function ChatPage() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const sendMessage = async () => {
        if (!input.trim()) return;

        const userMsg: Message = { role: "user", content: input };
        setMessages((prev) => [...prev, userMsg]);
        setInput("");
        setIsLoading(true);

        try {
            // Assuming API acts on localhost:8000 for local dev
            // In production, this should use an env var
            const response = await fetch("http://localhost:8000/chat/", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ message: userMsg.content }),
            });

            if (!response.ok) {
                throw new Error("Failed to send message");
            }

            const data = await response.json();
            const assistantMsg: Message = { role: "assistant", content: data.response };
            setMessages((prev) => [...prev, assistantMsg]);
        } catch (error) {
            console.error("Error sending message:", error);
            setMessages((prev) => [
                ...prev,
                { role: "assistant", content: "Sorry, something went wrong. Please try again." },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    return (
        <main className="flex flex-col h-screen p-6 bg-gray-50 text-gray-900">
            <div className="flex-1 overflow-auto mb-4 bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <h1 className="text-2xl font-bold mb-6 text-gray-800">Chat with Kait 🧠</h1>

                {messages.length === 0 && (
                    <div className="text-center text-gray-400 mt-20">
                        <p className="text-lg">Hi! I'm Kait. Ask me anything about products or orders.</p>
                        <div className="mt-4 flex flex-col gap-2 max-w-md mx-auto">
                            <button onClick={() => setInput("Who supplies Synology products?")} className="p-2 bg-gray-50 hover:bg-gray-100 rounded text-sm text-gray-600 border border-gray-200">"Who supplies Synology products?"</button>
                            <button onClick={() => setInput("What is the status of Order #900216?")} className="p-2 bg-gray-50 hover:bg-gray-100 rounded text-sm text-gray-600 border border-gray-200">"Status of Order #900216"</button>
                        </div>
                    </div>
                )}

                <div className="flex flex-col gap-4">
                    {messages.map((msg, index) => (
                        <div
                            key={index}
                            className={`p-4 rounded-xl max-w-[80%] whitespace-pre-wrap ${msg.role === "user"
                                ? "bg-blue-600 text-white self-end rounded-tr-none"
                                : "bg-gray-100 text-gray-800 self-start rounded-tl-none border border-gray-200"
                                }`}
                        >
                            {msg.content}
                        </div>
                    ))}
                    {isLoading && (
                        <div className="self-start p-4 bg-gray-100 rounded-xl rounded-tl-none text-gray-500 italic">
                            Kait is thinking...
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            <div className="flex gap-2">
                <input
                    type="text"
                    className="flex-1 p-4 rounded-xl border border-gray-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                    placeholder="Type a message..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isLoading}
                />
                <button
                    onClick={sendMessage}
                    disabled={isLoading || !input.trim()}
                    className="px-6 py-4 bg-blue-600 text-white rounded-xl font-medium shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                    Send
                </button>
            </div>
        </main>
    );
}
