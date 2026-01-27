
'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Sparkles, X, Minimize2, Maximize2, AlertCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown' // Ensure you have this installed: npm install react-markdown

interface Message {
    role: 'user' | 'assistant'
    content: string
    isError?: boolean
}

export default function ChatWidget() {
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [isOpen, setIsOpen] = useState(false) // Toggle chat open/close
    const [isExpanded, setIsExpanded] = useState(false) // Toggle expand/collapse
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    // Auto-scroll to bottom
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages, isOpen, isExpanded])

    // Focus input on open
    useEffect(() => {
        if (isOpen && !isLoading) {
            setTimeout(() => inputRef.current?.focus(), 300)
        }
    }, [isOpen, isLoading])

    const sendMessage = async () => {
        if (!input.trim()) return

        const userMsg: Message = { role: 'user', content: input }
        setMessages((prev) => [...prev, userMsg])
        setInput('')
        setIsLoading(true)

        try {
            // Using logic from server_chat.py: endpoint is /chat/
            // Assuming Next.js rewrites or direct localhost access.
            // Ideally use an environment variable for API URL.
            // Use environment variable for API URL, fallback to localhost for dev
            const apiUrl = process.env.NEXT_PUBLIC_CHAT_API_URL || 'http://localhost:8000/chat/'

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userMsg.content }),
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.detail || 'Connection failed')
            }

            const data = await response.json()
            setMessages((prev) => [...prev, { role: 'assistant', content: data.response }])
        } catch (error) {
            console.error('Chat Error:', error)
            setMessages((prev) => [
                ...prev,
                {
                    role: 'assistant',
                    content: 'I seem to be having trouble connecting to my brain. Please ensure the backend is running.',
                    isError: true
                },
            ])
        } finally {
            setIsLoading(false)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            sendMessage()
        }
    }

    // Minimized State (Launcher)
    if (!isOpen) {
        return (
            <motion.button
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 p-4 bg-lime-400 hover:bg-lime-500 text-black rounded-full shadow-[0_0_20px_rgba(132,204,22,0.5)] z-50 group flex items-center justify-center transition-all duration-300"
            >
                <Sparkles size={24} className="group-hover:rotate-12 transition-transform duration-300" />
            </motion.button>
        )
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0, y: 50, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 50, scale: 0.95 }}
                    transition={{ type: "spring", bounce: 0.3, duration: 0.5 }}
                    className={`fixed bottom-6 right-6 z-50 flex flex-col bg-[#0f0f0f]/90 backdrop-blur-xl border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.5)] rounded-3xl overflow-hidden transition-all duration-500 ease-in-out ${isExpanded ? 'w-[600px] h-[80vh]' : 'w-[400px] h-[550px]'
                        }`}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-white/5 bg-gradient-to-r from-lime-400/10 to-transparent">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-lime-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-lime-400/20">
                                <Sparkles size={20} className="text-black" />
                            </div>
                            <div>
                                <h3 className="text-white font-semibold text-base leading-tight">Kait</h3>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-lime-500 animate-pulse"></span>
                                    <span className="text-xs text-lime-500/80 font-medium">Online</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setIsExpanded(!isExpanded)}
                                className="p-2 hover:bg-white/5 rounded-full text-gray-400 hover:text-white transition-colors"
                            >
                                {isExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                            </button>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-2 hover:bg-red-500/20 rounded-full text-gray-400 hover:text-red-400 transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20">
                        {messages.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/5 flex items-center justify-center mb-2">
                                    <Sparkles size={32} className="text-lime-400/50" />
                                </div>
                                <div>
                                    <h4 className="text-white font-medium mb-1">How can I help you?</h4>
                                    <p className="text-sm text-gray-500 max-w-[200px] mx-auto">
                                        Ask about orders, check stock levels, or find supplier info.
                                    </p>
                                </div>
                                <div className="flex flex-wrap justify-center gap-2 max-w-[280px]">
                                    {['Stock for Sonos', 'Order #900216', 'Specials on TV'].map((suggestion) => (
                                        <button
                                            key={suggestion}
                                            onClick={() => setInput(suggestion)}
                                            className="text-xs bg-white/5 hover:bg-white/10 border border-white/5 text-gray-400 hover:text-lime-400 px-3 py-1.5 rounded-full transition-all"
                                        >
                                            {suggestion}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <AnimatePresence mode='popLayout'>
                            {messages.map((msg, idx) => (
                                <motion.div
                                    key={idx}
                                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    transition={{ duration: 0.3 }}
                                    className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div
                                        className={`max-w-[85%] text-sm px-4 py-3 shadow-sm ${msg.role === 'user'
                                            ? 'bg-lime-400 text-black rounded-2xl rounded-tr-sm font-medium'
                                            : msg.isError
                                                ? 'bg-red-500/10 border border-red-500/20 text-red-200 rounded-2xl rounded-tl-sm'
                                                : 'bg-[#1a1a1a] text-gray-200 rounded-2xl rounded-tl-sm border border-white/5'
                                            }`}
                                    >
                                        {msg.isError && <AlertCircle size={16} className="inline mr-2 -mt-0.5" />}
                                        {msg.role === 'assistant' ? (
                                            <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-black/30">
                                                <ReactMarkdown>{msg.content}</ReactMarkdown>
                                            </div>
                                        ) : (
                                            msg.content
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>

                        {isLoading && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex justify-start"
                            >
                                <div className="bg-[#1a1a1a] px-4 py-3 rounded-2xl rounded-tl-sm border border-white/5 flex gap-1.5 items-center h-[42px]">
                                    <span className="w-1.5 h-1.5 bg-lime-400/50 rounded-full animate-[bounce_1s_infinite_0ms]"></span>
                                    <span className="w-1.5 h-1.5 bg-lime-400/50 rounded-full animate-[bounce_1s_infinite_200ms]"></span>
                                    <span className="w-1.5 h-1.5 bg-lime-400/50 rounded-full animate-[bounce_1s_infinite_400ms]"></span>
                                </div>
                            </motion.div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-4 bg-[#0a0a0a]/50 border-t border-white/5 backdrop-blur-md">
                        <div className="relative flex items-center group">
                            <input
                                ref={inputRef}
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                disabled={isLoading}
                                placeholder="Type a message..."
                                className="w-full bg-[#1c1c1c] text-white text-sm rounded-2xl pl-5 pr-12 py-3.5 focus:outline-none focus:ring-1 focus:ring-lime-500/50 border border-white/5 group-hover:border-white/10 transition-all placeholder-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                            <button
                                onClick={sendMessage}
                                disabled={isLoading || !input.trim()}
                                className="absolute right-2 p-2 bg-gradient-to-br from-lime-400 to-lime-500 hover:from-lime-300 hover:to-lime-400 text-black rounded-xl shadow-lg shadow-lime-400/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                            >
                                <Send size={16} className={isLoading ? 'opacity-0' : 'opacity-100'} />
                                {isLoading && <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
                                </div>}
                            </button>
                        </div>
                        <div className="mt-2 text-center">
                            <span className="text-[10px] text-gray-600">AI can make mistakes. Verify important info.</span>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
