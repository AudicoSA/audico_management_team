# Phase 1 Testing Guide - AI-Native Chat Upgrade

## Overview
This guide will help you verify that all Phase 1 fixes are working correctly after deployment.

---

## Changes Implemented ✅

### 1. Frontend Endpoint Switch (CRITICAL)
**File:** `audico-chat-quote/src/components/chat/unified-chat.tsx` (Line 84)
- **Changed:** `/api/chat` → `/api/chat/ai-native`
- **Impact:** Full AI context retention, natural language understanding, multi-room memory

### 2. Car Audio Filter in Main Search
**File:** `audico-chat-quote/src/lib/search.ts` (Lines 216-228)
- **Added:** Car audio filtering for home audio searches
- **Impact:** No more car audio speakers in home cinema results

### 3. Car Audio Filter in Fallback Search
**File:** `audico-chat-quote/src/lib/search.ts` (Lines 300-303)
- **Added:** Car audio filtering for fallback search results
- **Impact:** Prevents car audio in ANY search path

### 4. Multi-Room Prompt Enhancement
**File:** `audico-chat-quote/src/lib/ai/system-prompts.ts` (Lines 177-195)
- **Added:** Explicit multi-room handling instructions
- **Impact:** Agent remembers all rooms in complex requests

---

## Pre-Deployment Checklist

- [ ] All code changes committed to git
- [ ] No TypeScript compilation errors: `npm run build`
- [ ] Development server starts: `npm run dev`
- [ ] AI-native endpoint exists: `/api/chat/ai-native/route.ts`

---

## Testing Protocol

### Test 1: Context Retention ⚡ CRITICAL
**Objective:** Verify AI maintains conversation context

**Steps:**
1. Start chat: "I need a 5.1 home cinema system"
2. Wait for AI response and product recommendations
3. Follow up: "Show me the floorstanding speakers"
4. AI should remember it's a home cinema system

**Expected Result:**
- ✅ AI shows passive floorstanding speakers (not car audio)
- ✅ AI remembers this is for home cinema
- ✅ AI doesn't ask "what system?" again

**Failure Signs:**
- ❌ AI forgets previous context
- ❌ AI asks you to repeat requirements
- ❌ Shows active/powered speakers for AVR system

---

### Test 2: Car Audio Filtering ⚡ HIGH PRIORITY
**Objective:** Verify car audio products are excluded from home searches

**Steps:**
1. Start fresh chat: "Show me floorstanding speakers for home"
2. Review product results

**Expected Result:**
- ✅ NO Focal 165AS (car kit)
- ✅ NO Hertz speakers (car audio brand)
- ✅ NO products with "coaxial" or "6x9" in name
- ✅ Only home speakers (Klipsch, KEF, B&W, DALI, etc.)

**Known Bad Products (should NOT appear):**
- Focal 165AS / 165KIT
- Hertz speakers
- JBL Club series (car audio)
- Any product with "component speaker" in name

---

### Test 3: Multi-Room Memory ⚡ HIGH PRIORITY
**Objective:** Verify AI remembers all rooms in complex requests

**Test Case A:**
1. Start chat: "Need audio for 5.1 cinema, kitchen ceiling speakers, bar wall mount, and studio desktop"
2. AI should acknowledge ALL FOUR requirements
3. Continue conversation, selecting products for cinema
4. After cinema: "Now show me kitchen ceiling speakers"

**Expected Result:**
- ✅ AI acknowledges all 4 rooms initially
- ✅ AI works through systematically
- ✅ AI remembers kitchen was mentioned earlier
- ✅ AI doesn't forget bar and studio

**Test Case B:**
1. Start fresh: "I need cinema and kitchen audio"
2. AI responds with plan
3. You: "Let's start with cinema"
4. AI: shows cinema products
5. You: "Now the kitchen"

**Expected Result:**
- ✅ AI remembers kitchen was in original request
- ✅ AI shows ceiling speakers for kitchen
- ✅ AI suggests amplifier for kitchen (ceiling speakers need power)

---

### Test 4: Correction Handling
**Objective:** Verify AI responds appropriately to user corrections

**Steps:**
1. If AI accidentally shows wrong products: "These are car speakers sir"
2. Observe AI response

**Expected Result:**
- ✅ AI apologizes
- ✅ AI acknowledges mistake
- ✅ AI searches again with correct filters
- ✅ AI shows correct products this time

---

### Test 5: Natural Language Understanding
**Objective:** Verify AI understands varied phrasing

**Test Queries (try each separately):**
1. "Need 5.1 cinema system"
2. "Want home theater surround sound"
3. "Looking for movie room audio"
4. "Setup for lounge entertainment"

**Expected Result for ALL:**
- ✅ AI understands this is home cinema
- ✅ AI asks about budget/room size/preferences
- ✅ AI recommends AVR + passive speakers + subwoofer
- ✅ NO active speakers, NO car audio

---

## Regression Tests (from Real Issues)

### Regression 1: The Floorstanding Speaker Bug
**Original Problem:** User asked for "floor speakers", got car audio

**Test:**
1. Chat: "Show me floorstanding speakers"
2. Expected: Klipsch/KEF/B&W floor speakers
3. NOT Expected: Focal 165AS car kit

### Regression 2: The Context Loss Bug
**Original Problem:** User selected AVR, then "floor please" returned car audio

**Test:**
1. Chat: "Need 5.1 cinema"
2. Select an AVR
3. Chat: "Floor please"
4. Expected: Passive floor speakers for home cinema
5. NOT Expected: Car audio

### Regression 3: The Multi-Room Amnesia
**Original Problem:** User mentioned "cinema, kitchen, bar", AI forgot kitchen and bar

**Test:**
1. Chat: "Need cinema, kitchen ceiling, bar wall mount"
2. Work through cinema setup
3. Chat: "Now kitchen"
4. Expected: AI remembers kitchen was mentioned, shows ceiling speakers
5. NOT Expected: "What kitchen? What are you looking for?"

---

## Performance Benchmarks

| Metric | Target | How to Measure |
|--------|--------|----------------|
| First response time | < 3 sec | Browser DevTools Network tab |
| Product search time | < 2 sec | Check API response time |
| Context retention | 100% | Manual testing |
| Car audio filtering | 100% | Search "floorstanding" - no car audio |

---

## Rollback Plan (If Issues Found)

### Immediate Rollback (< 5 minutes)

**Option 1: Environment Variable**
```bash
# Create .env.local (if using feature flag)
NEXT_PUBLIC_USE_AI_NATIVE=false

# Rebuild
npm run build

# Restart
pm2 restart audico-chat
```

**Option 2: Git Revert**
```bash
# Find commit hash
git log --oneline

# Revert changes
git revert <commit-hash>

# Push
git push

# Rebuild & restart
npm run build && pm2 restart audico-chat
```

**Option 3: Manual Edit**
```typescript
// File: src/components/chat/unified-chat.tsx, Line 84
// Change back to:
const response = await fetch("/api/chat", {
```

---

## Success Criteria

Before marking Phase 1 as complete, verify:

### Functional Requirements
- [ ] Multi-room requests understood (all rooms acknowledged)
- [ ] Context maintained across conversation turns
- [ ] No car audio in home cinema searches
- [ ] Corrections handled appropriately
- [ ] Natural language variations work

### Performance Requirements
- [ ] Response time < 3 seconds
- [ ] No memory leaks (check after 50+ messages)
- [ ] No console errors in browser
- [ ] API errors < 5%

### User Experience
- [ ] Conversation feels natural
- [ ] AI remembers previous selections
- [ ] Products are relevant
- [ ] No frustrating repetition

---

## Common Issues & Solutions

### Issue: "Cannot find module '/api/chat/ai-native'"
**Solution:** Ensure `/api/chat/ai-native/route.ts` exists
```bash
ls -la src/app/api/chat/ai-native/route.ts
```

### Issue: Still seeing car audio
**Solution:** Check filterOutCarAudio function is being called
```bash
# Add debug logging to verify
console.log('[CarAudioFilter] Applied, before:', products.length);
```

### Issue: Context not maintained
**Solution:** Verify sessionId is being passed
```typescript
// In unified-chat.tsx
console.log('SessionID:', sessionId); // Should be same across requests
```

### Issue: Performance degradation
**Solution:** Check database connection pool, verify search timeout settings

---

## Next Steps After Phase 1

Once Phase 1 is stable:
1. **Phase 2:** Run database migration to populate `component_type` field
2. **Phase 3:** Full test suite execution
3. **Phase 4:** Gradual production rollout (25% → 50% → 75% → 100%)
4. **Phase 5:** Long-term improvements (persistent storage, caching)

---

## Contact & Support

If you encounter issues:
1. Check browser console for errors (F12)
2. Check server logs for API errors
3. Test with different browsers (Chrome, Firefox)
4. Try incognito mode (clear cache)
5. Document exact steps to reproduce

**Remember:** This is the foundation for an award-winning chat experience. Take time to test thoroughly!

---

## Quick Reference: Test Commands

```bash
# Development testing
npm run dev
# Open: http://localhost:3001

# Build for production
npm run build

# Check TypeScript errors
npx tsc --noEmit

# View logs (if deployed)
pm2 logs audico-chat

# Restart server
pm2 restart audico-chat
```

---

**Last Updated:** 2026-01-25
**Status:** Phase 1 Complete - Ready for Testing
