"use client";

import { Send, Loader2, Bot, User, AlertTriangle, Paperclip, Image as ImageIcon, X, Trash2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ProductGrid } from "../products/product-grid";
import { StepIndicator } from "../quote/step-indicator";
import { ConsultationStatus } from "../ConsultationStatus";
import { TenderResults } from "../tender/tender-results";
import type { ChatMessage, Product, Step, QuoteItem, ConsultationRequestSummary } from "@/lib/types";

interface UnifiedChatProps {
  onQuoteUpdate: (items: QuoteItem[], quoteId?: string) => void;
  onNewChat?: () => void; // Callback when user starts a new chat
}

// Generate a simple ID without external dependencies
function generateId() {
  return Math.random().toString(36).substring(2, 15);
}

// Welcome message content
const WELCOME_CONTENT = `Hi! I'm your Audico assistant. I can help you build a complete audio system, get quick product quotes, or process tender documents.

What would you like to do today?`;

export function UnifiedChat({ onQuoteUpdate, onNewChat }: UnifiedChatProps) {
  // Initialize messages as empty - add welcome message on client only to avoid hydration mismatch
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentProducts, setCurrentProducts] = useState<Product[]>([]);
  const [currentStep, setCurrentStep] = useState<Step | null>(null);
  const [totalSteps, setTotalSteps] = useState(0);
  const [quoteId, setQuoteId] = useState<string | null>(null);
  const [flowType, setFlowType] = useState<string | null>(null);
  const [consultationRequest, setConsultationRequest] = useState<ConsultationRequestSummary | null>(null);
  const [isEscalated, setIsEscalated] = useState(false);
  const [tenderResults, setTenderResults] = useState<any>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [isProcessingTender, setIsProcessingTender] = useState(false);

  // Persist sessionId across all messages in this conversation to maintain agent context
  // Use sessionStorage (not localStorage) so refresh = new session, matching UI reset behavior
  const [sessionId, setSessionId] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('audico_session_id');
      if (stored) return stored;
      const newId = generateId();
      sessionStorage.setItem('audico_session_id', newId);
      return newId;
    }
    return generateId();
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastMessageRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize welcome message on client only (avoids hydration mismatch from new Date())
  useEffect(() => {
    if (!isInitialized) {
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content: WELCOME_CONTENT,
          timestamp: new Date(),
        },
      ]);
      setIsInitialized(true);
      inputRef.current?.focus();
    }
  }, [isInitialized]);

  // Auto-scroll to the last message (not the bottom, so user sees the text first)
  useEffect(() => {
    lastMessageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [messages]);

  const addMessage = (role: ChatMessage["role"], content: string, products?: Product[], step?: Step) => {
    const message: ChatMessage = {
      id: generateId(),
      role,
      content,
      products,
      step,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, message]);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    addMessage("user", userMessage);
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat/ai-native", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          quoteId,
          flowType,
          sessionId, // Persist session to maintain agent conversation history
        }),
      });

      const data = await response.json();

      if (data.error) {
        addMessage("assistant", `Sorry, something went wrong: ${data.error}`);
        return;
      }

      if (data.quoteId) setQuoteId(data.quoteId);
      if (data.flowType) setFlowType(data.flowType);
      if (data.currentStep) setCurrentStep(data.currentStep);
      if (data.totalSteps) setTotalSteps(data.totalSteps);
      if (data.products) setCurrentProducts(data.products);
      if (data.quoteItems) onQuoteUpdate(data.quoteItems);
      if (data.consultationRequest) setConsultationRequest(data.consultationRequest);
      if (data.isEscalated) setIsEscalated(data.isEscalated);

      addMessage("assistant", data.message, data.products, data.currentStep);
    } catch (error) {
      console.error("Chat error:", error);
      addMessage("assistant", "Sorry, I encountered an error. Please try again.");
    } finally {
      setIsLoading(false);
      // Auto-focus input for seamless conversation
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleProductSelect = async (product: Product) => {
    setIsLoading(true);
    addMessage("user", `Selected: ${product.name}`);

    try {
      // For AI-native flow, send selection back to AI as a message
      if (flowType === "ai_native") {
        const selectionMessage = `I'll take the ${product.name} (SKU: ${product.sku}) at R${product.price.toLocaleString()}.`;

        const response = await fetch("/api/chat/ai-native", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: selectionMessage,
            quoteId,
            flowType,
            sessionId,
          }),
        });

        const data = await response.json();

        if (data.error) {
          addMessage("assistant", `Sorry, something went wrong: ${data.error}`);
          return;
        }

        if (data.quoteId) setQuoteId(data.quoteId);
        if (data.products) setCurrentProducts(data.products);
        if (data.quoteItems) onQuoteUpdate(data.quoteItems, data.quoteId || quoteId || undefined);

        addMessage("assistant", data.message, data.products);
        return;
      }

      // For other flows (system_design, simple_quote), use the old approach
      if (!quoteId) return;

      const endpoint =
        flowType === "system_design"
          ? "/api/system-design/select"
          : "/api/simple-quote/add";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteId,
          productId: product.id,
          product,
          quantity: 1,
        }),
      });

      const data = await response.json();

      if (data.error) {
        addMessage("assistant", `Sorry, something went wrong: ${data.error}`);
        return;
      }

      if (data.currentStep) setCurrentStep(data.currentStep);
      if (data.products) setCurrentProducts(data.products);
      if (data.quoteItems || data.selectedProducts) {
        onQuoteUpdate(data.quoteItems || data.selectedProducts, quoteId || undefined);
      }
      if (data.isComplete) {
        setCurrentProducts([]);
        setCurrentStep(null);
      }

      addMessage("assistant", data.message, data.products, data.currentStep);
    } catch (error) {
      console.error("Selection error:", error);
      addMessage("assistant", "Sorry, I couldn't process your selection. Please try again.");
    } finally {
      setIsLoading(false);
      // Auto-focus input for seamless conversation
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (uploadPreview) {
        handleProcessTender();
      } else {
        handleSend();
      }
    }
  };

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      addMessage('assistant', 'Please upload an image file (JPG, PNG) or PDF document.');
      return;
    }

    // Convert to base64 for preview and API
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setUploadPreview(base64);
    };
    reader.readAsDataURL(file);

    // Reset file input
    e.target.value = '';
  };

  // Process tender document
  const handleProcessTender = async () => {
    if (!uploadPreview) return;

    setIsProcessingTender(true);
    addMessage('user', '📎 [Uploaded tender document for processing]');
    addMessage('assistant', 'Processing your tender document... This may take a moment as I analyze the image and match products.');

    try {
      const response = await fetch('/api/tender/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: uploadPreview,
          sessionId,
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to process document');
      }

      // Store tender results
      setTenderResults(data.matches);

      // Build response message
      const { summary } = data.matches;
      let message = `I've analyzed your tender document and found **${summary.total} items**:\n\n`;
      message += `✅ **${summary.matched}** products matched in our catalog\n`;
      message += `⚠️ **${summary.partial}** products need your review\n`;
      message += `❌ **${summary.unmatched}** products not found (flagged for sourcing)\n\n`;
      message += `Expand items below to see matches and add to your quote.`;

      addMessage('assistant', message);

    } catch (error: any) {
      console.error('Tender processing error:', error);
      addMessage('assistant', `Sorry, I couldn't process that document: ${error.message}. Please try again with a clearer image.`);
    } finally {
      setIsProcessingTender(false);
      setUploadPreview(null);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  // Simple inline message bubble to avoid import issues
  const renderMessage = (message: ChatMessage) => {
    const isUser = message.role === "user";
    return (
      <div className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
        <div
          className={cn(
            "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
            isUser ? "bg-accent" : "bg-background-elevated border border-border"
          )}
        >
          {isUser ? (
            <User size={16} className="text-background" />
          ) : (
            <Bot size={16} className="text-accent" />
          )}
        </div>
        <div
          className={cn(
            "max-w-[90%] sm:max-w-[80%] md:max-w-[70%] rounded-2xl px-3 py-2 sm:px-4 sm:py-3",
            isUser
              ? "bg-accent text-background rounded-br-md"
              : "bg-background-card border border-border text-foreground rounded-bl-md"
          )}
        >
          <div className="whitespace-pre-wrap text-sm leading-relaxed">
            {message.content}
          </div>
        </div>
      </div>
    );
  };

  // Handle new chat / session reset
  const handleNewChat = () => {
    if (confirm("Start a new chat? This will clear your current conversation and quote.")) {
      // 1. Generate new ID
      const newId = generateId();

      // 2. Update persistence
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('audico_session_id', newId);
      }
      setSessionId(newId);

      // 3. Reset State
      setMessages([
        {
          id: "welcome",
          role: "assistant", // Fixed: strict literal type
          content: WELCOME_CONTENT,
          timestamp: new Date(),
        },
      ]);
      setQuoteId(null);
      setFlowType(null);
      setCurrentProducts([]);
      setCurrentStep(null);
      setTotalSteps(0);
      setConsultationRequest(null);
      setIsEscalated(false);
      setTenderResults(null);
      setUploadPreview(null);

      // 4. Clear URL if present
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        if (url.searchParams.has('quoteId')) {
          url.searchParams.delete('quoteId');
          window.history.replaceState({}, '', url.toString());
        }
      }

      // 5. Notify parent to clear quote
      if (onNewChat) {
        onNewChat();
      }

      // 6. Notify user
      addMessage("assistant", "Started a new session. How can I help?");
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <header className="flex items-center justify-between h-14 sm:h-16 px-3 sm:px-6 border-b border-border bg-background-secondary">
        <div className="flex items-center gap-2">
          <h1 className="text-base sm:text-lg font-semibold text-foreground">Quote Builder</h1>
          <span className="bg-accent/20 text-accent text-xs font-bold px-2 py-0.5 rounded-full border border-accent/30">
            BETA
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleNewChat}
            className="p-2 text-foreground-muted hover:text-error hover:bg-error/10 rounded-full transition-colors"
            title="Start New Chat (Clear History)"
          >
            <Trash2 size={18} />
          </button>

          {currentStep && totalSteps > 0 && (
            <StepIndicator
              currentStep={currentStep.id}
              totalSteps={totalSteps}
              stepLabel={currentStep.label}
            />
          )}
        </div>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-3 sm:space-y-4">
        {!isInitialized && (
          <div className="flex items-center gap-2 text-foreground-muted">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-sm">Loading...</span>
          </div>
        )}
        {messages.map((message, index) => (
          <div
            key={message.id}
            ref={index === messages.length - 1 ? lastMessageRef : null}
          >
            {renderMessage(message)}
            {message.role === "assistant" && message.products && message.products.length > 0 && !isEscalated && (
              <div className="mt-4 ml-12">
                <ProductGrid
                  products={message.products}
                  onSelect={handleProductSelect}
                  disabled={isLoading}
                />
              </div>
            )}
          </div>
        ))}

        {/* Consultation Status Display */}
        {isEscalated && consultationRequest && (
          <div className="ml-12">
            <ConsultationStatus consultation={consultationRequest} />
          </div>
        )}

        {/* Escalation Warning Banner */}
        {isEscalated && (
          <div className="ml-12 bg-yellow-50 border-l-4 border-yellow-400 p-3 mb-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-yellow-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  This project has been escalated to our specialist team for professional design and planning.
                </p>
              </div>
            </div>
          </div>
        )}

        {currentProducts.length > 0 && !messages[messages.length - 1]?.products && !isEscalated && (
          <div className="ml-12">
            <ProductGrid
              products={currentProducts}
              onSelect={handleProductSelect}
              disabled={isLoading}
            />
          </div>
        )}

        {/* Show message if escalated instead of products */}
        {isEscalated && currentProducts.length > 0 && (
          <div className="ml-12 text-center py-8 text-gray-600">
            <p>Product recommendations will be provided by our specialist team in your custom proposal.</p>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center gap-2 text-foreground-muted ml-12">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-sm">Thinking...</span>
          </div>
        )}

        {/* Tender Results */}
        {tenderResults && tenderResults.results.length > 0 && (
          <div className="ml-12 max-w-3xl">
            <TenderResults
              results={tenderResults.results}
              summary={tenderResults.summary}
              onAddToQuote={(product, quantity) => {
                // Add to quote logic - reuse handleProductSelect
                handleProductSelect(product);
              }}
              disabled={isLoading}
            />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Upload Preview */}
      {uploadPreview && (
        <div className="px-3 sm:px-6 py-2 bg-background-secondary border-t border-border">
          <div className="flex items-center gap-3 max-w-4xl mx-auto">
            <div className="relative">
              <img
                src={uploadPreview}
                alt="Upload preview"
                className="h-16 w-auto rounded-lg border border-border"
              />
              <button
                onClick={() => setUploadPreview(null)}
                className="absolute -top-2 -right-2 bg-error text-background rounded-full p-1 hover:bg-error/80"
              >
                <X size={12} />
              </button>
            </div>
            <div className="flex-1">
              <p className="text-sm text-foreground">Tender document ready</p>
              <p className="text-xs text-foreground-muted">Click send to process</p>
            </div>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="p-3 sm:p-4 border-t border-border bg-background-secondary">
        <div className="flex items-center gap-2 sm:gap-3 max-w-4xl mx-auto">
          {/* File Upload Button */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading || isProcessingTender}
            className={cn(
              "p-3 rounded-lg transition-colors",
              isLoading || isProcessingTender
                ? "opacity-50 cursor-not-allowed text-foreground-muted"
                : "text-foreground-muted hover:text-accent hover:bg-background-elevated"
            )}
            title="Upload tender document"
          >
            <Paperclip size={20} />
          </button>

          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={uploadPreview ? "Press send to process document..." : "Type your message..."}
            className="input-field flex-1"
            disabled={isLoading || isProcessingTender}
          />
          <button
            type="button"
            onClick={uploadPreview ? handleProcessTender : handleSend}
            disabled={(!input.trim() && !uploadPreview) || isLoading || isProcessingTender}
            className={cn(
              "bg-accent text-background font-semibold p-3 rounded-lg transition-all",
              ((!input.trim() && !uploadPreview) || isLoading || isProcessingTender)
                ? "opacity-50 cursor-not-allowed"
                : "hover:bg-accent-hover hover:scale-105"
            )}
          >
            {isProcessingTender ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <Send size={20} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
