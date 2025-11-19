# AI Training & Improvement Guide

## How the AI Learns

The AI system uses **prompt engineering** rather than machine learning. This means it's controlled by instructions, not trained on data.

## Methods to Improve AI Responses

### 1. **System Prompts** (Primary Method)
Edit the instructions in `src/models/llm_client.py`

**Files to edit:**
- `classify_email()` function - Controls email classification
- `draft_email_response()` function - Controls response drafting

**What you can add:**
- Company policies ("Never promise refunds over R2000 without approval")
- Tone examples ("Good: ... Bad: ...")
- Specific product knowledge
- Common scenarios and how to handle them

**Example:**
```python
system_prompt = f"""You are a customer service rep for Audico Online.

POLICIES:
- Returns accepted within 14 days
- Warranty claims require proof of purchase
- International shipping takes 7-14 days

COMMON SCENARIOS:
- If customer asks about delivery: Check order status first, then provide tracking
- If product out of stock: Apologize, offer alternative, give ETA if possible
```

### 2. **Email Classification** (Just Fixed!)
**What we changed:**
- Added `INTERNAL_STAFF` category for emails between team members
- Added `SUPPLIER_COMMUNICATION` for distributor emails
- System now SKIPS drafting responses for these categories

**To add more filters:**
Edit the `skip_categories` list in `src/agents/email_agent.py` (line 103)

### 3. **Few-Shot Examples** (Advanced)
Add real examples of good responses to the system prompt:

```python
EXAMPLE GOOD RESPONSES:

Customer: "Where is my order?"
Response: "Thank you for your enquiry! I've checked order #12345 and it was dispatched
yesterday via courier. Your tracking number is ABC123. You should receive it within 2-3
business days. Kind regards, Audico Online Support Team"

Customer: "This headset is broken!"
Response: "I'm very sorry to hear about the issue with your headset. We'd like to help
resolve this quickly. Please reply with your order number and a photo of the defect, and
we'll arrange a replacement or repair. Best regards, Audico Online Support Team"
```

### 4. **Context Enhancement**
Give the AI more information by improving `_gather_context()` in `email_agent.py`:

**Current context:**
- Order details from OpenCart (if available)
- Shipment tracking from Shiplogic (if available)

**Future additions:**
- Customer purchase history
- Product specifications from database
- Previous email conversations
- Company knowledge base (FAQs)

### 5. **Temperature Adjustment**
Control randomness in `src/utils/config.py`:

```python
# Current settings:
classification_model: str = "gpt-4o-mini"  # temperature=0.3 (factual)
email_draft_model: str = "gpt-4o-mini"      # temperature=0.7 (creative)

# Lower temperature (0.0-0.5) = More consistent, factual
# Higher temperature (0.5-1.0) = More creative, varied
```

## Testing Improvements

After making changes, test with:

```bash
cd "D:\AudicoAI\Audico Management Team\audico-ai"
python test_next_email.py
```

## Advanced: Fine-Tuning (Not Recommended Yet)

You CAN fine-tune models on your specific data, but:
- **Cost:** $$ expensive for GPT-4 models
- **Effort:** Need 50-100+ examples of perfect responses
- **Maintenance:** Must retrain when policies change
- **Overkill:** Prompt engineering usually works better

**Only consider if:**
- You have 100+ reviewed, approved email responses
- Prompt engineering isn't achieving 85%+ quality
- You're willing to invest in ongoing training

## Monitoring & Iteration

1. **Check Supabase logs** - See which categories are being used
2. **Review drafts regularly** - Note patterns in what needs editing
3. **Collect good examples** - Save well-edited responses as templates
4. **Update prompts weekly** - Based on common issues you see

## Quick Wins

**To improve responses right now:**

1. **Add your return policy** to the system prompt
2. **Add common product questions** and answers
3. **Add your team's email addresses** to skip internal emails
4. **Add supplier/distributor domains** to skip those emails
5. **Add shipping timeframes** by region

## Need Help?

Edit these files:
- `src/models/llm_client.py` - Classification and response prompts
- `src/agents/email_agent.py` - Email processing logic
- `src/utils/config.py` - Model settings

Then restart the server and test!
