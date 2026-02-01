import logging
import json
from typing import Dict, Any, List, Optional
from src.connectors.supabase import get_supabase_connector
from src.utils.config import get_config
from openai import OpenAI

logger = logging.getLogger("ChatAgent")

class ChatAgent:
    """
    Agent for Internal Staff Chat ("Talk to Kait").
    capable of querying products and orders.
    """

    def __init__(self):
        self.sb = get_supabase_connector()
        self.config = get_config()
        self.client = OpenAI(api_key=self.config.openai_api_key)
        self.model = self.config.model_routing.get("chat_model", "gpt-4o-mini") if hasattr(self.config, "model_routing") else "gpt-4o-mini"

    async def search_products(self, query: str) -> str:
        """
        Search for products in the database.
        Useful for answering questions like "Who supplies Synology?" or "Do we have stock of X?"
        """
        logger.info(f"Searching products with query: {query}")
        try:
            # 1. Try splitting query into terms for smarter matching
            terms = query.strip().split()
            if not terms:
                return "Please provide a search term."
            
            # Construct a flexible query:
            # We want to find items where product_name contains ALL terms
            # OR sku contains the full query
            # OR brand contains the full query
            
            # Start with base query
            db_query = self.sb.client.table("products").select("*")
            
            # If plain single word, use simple OR
            if len(terms) == 1:
                db_query = db_query.or_(f"product_name.ilike.%{query}%,sku.ilike.%{query}%,brand.ilike.%{query}%")
                response = db_query.limit(10).execute()
            else:
                # For multiple words, we want:
                # (Name matches Term1 OR SKU matches Term1 OR Brand matches Term1)
                # AND
                # (Name matches Term2 OR SKU matches Term2 OR Brand matches Term2)
                # ...
                
                # Supabase/Postgrest allows chaining filters which acts as AND.
                # So we chain an .or_() for each term.
                
                temp_q = self.sb.client.table("products").select("*")
                for term in terms:
                    # Construct the OR filter for this specific term
                    # "product_name.ilike.%term%,sku.ilike.%term%,brand.ilike.%term%"
                    term_filter = f"product_name.ilike.%{term}%,sku.ilike.%{term}%,brand.ilike.%{term}%"
                    temp_q = temp_q.or_(term_filter)
                
                response = temp_q.limit(10).execute()

            products = response.data
            
            # 2. If strict AND search yields nothing, try relaxed OR search (any term match)
            if not products and len(terms) > 1:
                 # Try finding ANY term (less strict)
                 # This is one giant OR: Name/SKU match Term1 OR Name/SKU match Term2...
                 
                 # Build a list of conditions
                 conditions = []
                 for t in terms:
                     conditions.append(f"product_name.ilike.%{t}%")
                     conditions.append(f"sku.ilike.%{t}%")
                     conditions.append(f"brand.ilike.%{t}%")
                 
                 or_clause = ",".join(conditions)
                 response = self.sb.client.table("products").select("*").or_(or_clause).limit(10).execute()
                 products = response.data

            if not products:
                return "No products found matching that query."
            
            # Resolve Supplier IDs
            supplier_ids = list(set([p['supplier_id'] for p in products if p.get('supplier_id')]))
            supplier_map = {}
            if supplier_ids:
                try:
                    sup_res = self.sb.client.table("suppliers").select("id, name").in_("id", supplier_ids).execute()
                    for s in sup_res.data:
                        supplier_map[s['id']] = s['name']
                except Exception as e:
                    logger.error(f"Error fetching suppliers: {e}")

            # Format product info
            result_str = f"Found {len(products)} products for '{query}':\n\n"
            for p in products:
                sup_name = supplier_map.get(p.get('supplier_id'), "Unknown Supplier")
                
                result_str += f"- **{p.get('product_name')}**\n"
                result_str += f"  - Brand: {p.get('brand')}\n"
                result_str += f"  - SKU: `{p.get('sku')}`\n"
                result_str += f"  - Supplier: {sup_name}\n" 
                
                # Check for price/stock
                if 'price' in p: result_str += f"  - Price: {p['price']}\n"
                if 'selling_price' in p: result_str += f"  - Selling Price: {p['selling_price']}\n"
                
                stock = p.get('total_stock', 0)
                stock_display = f"**{stock}**" if stock > 0 else "0 (Out of Stock)"
                result_str += f"  - Stock: {stock_display}\n"
                
                result_str += "\n"
                
            return result_str
            
        except Exception as e:
            logger.error(f"Error searching products: {e}")
            return f"Error searching products: {e}"

    async def search_orders(self, query: str) -> str:
        """
        Search for orders in the tracker.
        Useful for questions like "Status of order #900216?"
        """
        logger.info(f"Searching orders with query: {query}")
        try:
            # Check for exact order number match match
            clean_query = query.strip().replace("#", "")
            
            response = self.sb.client.table("orders_tracker").select("*").eq("order_no", clean_query).execute()
            
            if not response.data:
                # Try partial match on order_name or supplier
                response = self.sb.client.table("orders_tracker").select("*").or_(f"order_name.ilike.%{query}%,supplier.ilike.%{query}%").limit(5).execute()
            
            orders = response.data
            if not orders:
                return f"No orders found matching '{query}'."
                
            result_str = f"Found {len(orders)} orders:\n\n"
            for o in orders:
                result_str += f"### Order #{o.get('order_no')}\n"
                result_str += f"- **Name**: {o.get('order_name')}\n"
                result_str += f"- **Supplier**: {o.get('supplier')}\n"
                result_str += f"- **Status**: {o.get('supplier_status')}\n"
                if o.get('updates'):
                    result_str += f"- **Latest Update**: _{str(o.get('updates'))[:200]}..._\n"
                result_str += "\n"
                
            return result_str

        except Exception as e:
            logger.error(f"Error searching orders: {e}")
            return f"Error searching orders: {e}"

    async def process_message(self, user_message: str, sender: str = "User") -> str:
        """
        Process a user message and return a response.
        """
        tools = [
            {
                "type": "function",
                "function": {
                    "name": "search_products",
                    "description": "Search for products info (supplier, stock, price, etc). Use this when user asks about 'who supplies', 'stock of', 'price of' a product.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "query": {
                                "type": "string",
                                "description": "The search term (e.g. 'Sonos', 'ERA100', 'Synology').",
                            }
                        },
                        "required": ["query"],
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "search_orders",
                    "description": "Search for order status or details. Use when user asks about a specific order number or orders from a supplier.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "query": {
                                "type": "string",
                                "description": "The search term (e.g. '900216', 'Planetworld orders').",
                            }
                        },
                        "required": ["query"],
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "search_specials",
                    "description": "Search for supplier specials or deals. Use when user asks 'Any specials on X?' or 'Cheapest X'.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "query": {
                                "type": "string",
                                "description": "The product name to check for specials (e.g. 'Samsung TV').",
                            }
                        },
                        "required": ["query"],
                    },
                },
            },
        ]

        messages = [
            {"role": "system", "content": "You are Kait, the internal AI assistant for Audico. You help staff (Wade, Lucky, Kenny) with checking stock, finding suppliers, and tracking orders. Be concise and helpful. Use your tools to look up real data."},
            {"role": "user", "content": user_message}
        ]

        try:
            # First call to LLM
            completion = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                tools=tools,
                tool_choice="auto"
            )
            
            response_message = completion.choices[0].message
            
            if response_message.tool_calls:
                messages.append(response_message)
                
                for tool_call in response_message.tool_calls:
                    function_name = tool_call.function.name
                    function_args = json.loads(tool_call.function.arguments)
                    
                    if function_name == "search_products":
                        tool_result = await self.search_products(function_args.get("query"))
                    elif function_name == "search_orders":
                        tool_result = await self.search_orders(function_args.get("query"))
                    elif function_name == "search_specials":
                        from src.agents.specials_agent import get_specials_agent
                        agent = get_specials_agent()
                        tool_result = await agent.search_specials(function_args.get("query"))
                    else:
                        tool_result = "Error: Unknown tool."
                        
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "name": function_name,
                        "content": tool_result
                    })
                
                # Final answer
                final_completion = self.client.chat.completions.create(
                    model=self.model,
                    messages=messages
                )
                return final_completion.choices[0].message.content
            
            else:
                return response_message.content

        except Exception as e:
            logger.error(f"Error in chat processing: {e}")
            return "Sorry, I encountered an error while processing your request."

_chat_agent: Optional[ChatAgent] = None
def get_chat_agent() -> ChatAgent:
    global _chat_agent
    if _chat_agent is None:
        _chat_agent = ChatAgent()
    return _chat_agent
