# 🚀 OpenAI Quick Start - Fix Network Issues

## 3-Step Setup

### 1. Add One Line to .env.local

Open `audico-chat-quote/.env.local` and add:

```bash
AI_PROVIDER=openai
```

### 2. Restart Dev Server

```bash
cd audico-chat-quote
npm run dev
```

### 3. Test in Browser

Open: http://localhost:3000

Send message:
```
hi, need help with a 7.1.2 system for my cinema please
```

**Expected Result**: Product cards should appear! 🎉

---

## Success Indicators

### In Terminal:
```
[AI-Native] 🚀 New request (Provider: openai)
[OpenAIHandler] Using OpenAI (GPT-4) provider
[OpenAIHandler] 🔧 Tool iteration 1
[OpenAIHandler] Executing tool: search_products_by_keyword
[OpenAIHandler] 🔧 Tool iteration 2
[OpenAIHandler] Executing tool: provide_final_recommendation
[AI-Native] ✅ Success - Returning 4 products
```

### In Browser:
- ✅ No connection errors
- ✅ 3-4 product cards displayed
- ✅ Images, prices, stock visible
- ✅ "Add to Quote" buttons work

---

## If It Works

Congratulations! OpenAI bypassed your network issues.

Continue to **Week 4 Part B: Email Notifications**

## If It Doesn't Work

Try:
1. Check `.env.local` has `OPENAI_API_KEY=sk-...`
2. Restart server completely (Ctrl+C, then npm run dev)
3. Check browser console for errors
4. Check terminal for error messages

See [SWITCH_TO_OPENAI.md](./SWITCH_TO_OPENAI.md) for detailed troubleshooting.

---

## Switch Back to Claude

Remove or comment out the line in `.env.local`:

```bash
# AI_PROVIDER=openai
```

Restart server. Done!

---

**That's it!** One line change. 🚀
