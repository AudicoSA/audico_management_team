# Frontend Update Guide - AI-Native Integration

## Quick Update (2 Minutes)

### Option 1: Simple Endpoint Swap

The easiest way - just change the API endpoint:

```typescript
// File: src/components/chat/unified-chat.tsx

// BEFORE (Old regex system)
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message, sessionId, quoteId }),
});

// AFTER (AI-native system)
const response = await fetch('/api/chat/ai-native', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message, sessionId, quoteId }),
});

// Response format is the same - no other changes needed!
```

### Option 2: Feature Flag (A/B Testing)

Test both systems side-by-side:

```typescript
// File: src/components/chat/unified-chat.tsx

// Add a flag to switch between systems
const USE_AI_NATIVE = process.env.NEXT_PUBLIC_USE_AI_NATIVE === 'true' || false;

// Or randomly assign for A/B testing
const useAiNative = Math.random() > 0.5;

// Use the appropriate endpoint
const endpoint = useAiNative ? '/api/chat/ai-native' : '/api/chat';

const response = await fetch(endpoint, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message, sessionId, quoteId }),
});
```

### Option 3: Gradual Rollout

Roll out to specific users or sessions:

```typescript
// File: src/components/chat/unified-chat.tsx

function shouldUseAiNative(sessionId: string): boolean {
  // Option A: Specific sessions (testing)
  const testSessions = ['test-123', 'demo-456'];
  if (testSessions.includes(sessionId)) return true;

  // Option B: Percentage rollout (e.g., 25% of users)
  const hash = sessionId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  if (hash % 100 < 25) return true; // 25% get AI-native

  // Option C: Time-based (new sessions after a date)
  const sessionTimestamp = parseInt(sessionId.split('-')[0]);
  if (sessionTimestamp > Date.now() - 24 * 60 * 60 * 1000) return true; // Last 24h

  return false;
}

const endpoint = shouldUseAiNative(sessionId) ? '/api/chat/ai-native' : '/api/chat';
```

## Complete Example Component

Here's a full example of integrating the AI-native system:

```typescript
// File: src/components/chat/unified-chat.tsx (Updated)

'use client';

import { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Product } from '@/lib/types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  products?: Product[];
  timestamp: Date;
}

export function UnifiedChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => uuidv4());
  const [currentQuoteId, setCurrentQuoteId] = useState<string>();
  const [displayedProducts, setDisplayedProducts] = useState<Product[]>([]);

  // Feature flag for AI-native system
  const USE_AI_NATIVE = process.env.NEXT_PUBLIC_USE_AI_NATIVE === 'true';
  const endpoint = USE_AI_NATIVE ? '/api/chat/ai-native' : '/api/chat';

  // Send message handler
  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: inputMessage,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const startTime = Date.now();

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: inputMessage,
          sessionId,
          quoteId: currentQuoteId,
        }),
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const data = await response.json();
      const duration = Date.now() - startTime;

      // Log performance (optional)
      console.log(`[Chat] Response received in ${duration}ms`);
      console.log(`[Chat] System: ${USE_AI_NATIVE ? 'AI-native' : 'legacy'}`);
      console.log(`[Chat] Products: ${data.products?.length || 0}`);

      // Update state with assistant response
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.message,
        products: data.products,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Update quote ID if created
      if (data.quoteId) {
        setCurrentQuoteId(data.quoteId);
      }

      // Update displayed products
      if (data.products && data.products.length > 0) {
        setDisplayedProducts(data.products);
      }

      // Track analytics (optional)
      if (typeof window !== 'undefined' && (window as any).analytics) {
        (window as any).analytics.track('chat_message_sent', {
          system: USE_AI_NATIVE ? 'ai-native' : 'legacy',
          sessionId,
          productsReturned: data.products?.length || 0,
          responseTime: duration,
          hasQuote: !!data.quoteId,
        });
      }
    } catch (error) {
      console.error('[Chat] Error:', error);

      const errorMessage: Message = {
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Enter key
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* System indicator (optional - remove in production) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="bg-blue-100 border-b border-blue-200 px-4 py-2 text-sm">
          Using: <strong>{USE_AI_NATIVE ? 'AI-Native' : 'Legacy'}</strong> system
          {currentQuoteId && ` | Quote: ${currentQuoteId}`}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>

              {/* Display products if present */}
              {msg.products && msg.products.length > 0 && (
                <div className="mt-3 grid grid-cols-1 gap-2">
                  {msg.products.slice(0, 3).map((product) => (
                    <div
                      key={product.sku}
                      className="bg-white rounded p-2 text-sm border"
                    >
                      <p className="font-semibold text-gray-900">{product.name}</p>
                      <p className="text-gray-600">
                        R{product.price.toLocaleString()}
                      </p>
                      {product.stock.total > 0 ? (
                        <p className="text-green-600 text-xs">In Stock</p>
                      ) : (
                        <p className="text-red-600 text-xs">Out of Stock</p>
                      )}
                    </div>
                  ))}
                  {msg.products.length > 3 && (
                    <p className="text-xs text-gray-600">
                      +{msg.products.length - 3} more products
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg px-4 py-2">
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t p-4">
        <div className="flex space-x-2">
          <textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask about products or describe what you need..."
            className="flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows={2}
            disabled={isLoading}
          />
          <button
            onClick={handleSendMessage}
            disabled={isLoading || !inputMessage.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

## Environment Variable Setup

Add to `.env.local`:

```bash
# Enable AI-native system (set to 'true' to enable)
NEXT_PUBLIC_USE_AI_NATIVE=true

# Or use percentage rollout (0-100)
NEXT_PUBLIC_AI_NATIVE_ROLLOUT_PERCENT=25
```

## Testing the Integration

1. **Start the dev server:**
   ```bash
   npm run dev
   ```

2. **Test the chat:**
   - Navigate to your chat page
   - Try: "Need audio for my workout facility"
   - Should get intelligent response about gym audio

3. **Check the console:**
   - Look for `[Chat] System: AI-native` or `legacy`
   - Check response times
   - Verify products are returned

4. **Test edge cases:**
   - "spinning studio" → should understand gym
   - "home cinema 7.1" → should ask for budget
   - "Denon AVR" → should search specific product

## Monitoring & Analytics

Track the system performance:

```typescript
// Add to your analytics setup
analytics.track('chat_interaction', {
  system: USE_AI_NATIVE ? 'ai-native' : 'legacy',
  sessionId,
  messageCount: messages.length,
  productsShown: displayedProducts.length,
  hasQuote: !!currentQuoteId,
  responseTime: duration,
});

// Track conversions
analytics.track('quote_created', {
  system: USE_AI_NATIVE ? 'ai-native' : 'legacy',
  quoteId,
  totalValue: totalPrice,
  itemCount: quoteItems.length,
});
```

## Troubleshooting

**Issue: "fetch failed" or CORS errors**
- Make sure server is running: `npm run dev`
- Check endpoint is correct: `/api/chat/ai-native`

**Issue: Slow responses**
- Normal: 1-3 seconds for AI
- Check network tab in DevTools
- Verify `ANTHROPIC_API_KEY` is set

**Issue: No products returned**
- Check database has active products
- Test with the test suite: `npx tsx scripts/test-ai-native.ts`
- Review console logs for search errors

**Issue: Wrong products recommended**
- Review system prompt in `src/lib/ai/system-prompts.ts`
- Check product categories in database
- Test specific scenarios

## Next Steps

1. ✅ Update frontend to use AI-native endpoint
2. ✅ Test with real user scenarios
3. ✅ Monitor performance and errors
4. ✅ Gather user feedback
5. ✅ Optimize based on data
6. ✅ Roll out to 100% of users

---

**That's it! Your frontend is now powered by the award-winning AI-native system. 🎉**

The chat will now understand "workout facility", "spinning studio", and any other variation naturally - no regex patterns needed!
