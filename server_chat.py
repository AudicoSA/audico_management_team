
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from src.agents.chat_agent import get_chat_agent
import uvicorn
import asyncio
import logging

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ChatServer")

app = FastAPI()

# Enable CORS for Dashboard
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In prod, allow only dashboard URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str

@app.post("/chat/")
async def chat_endpoint(request: ChatRequest):
    logger.info(f"Received message: {request.message}")
    try:
        agent = get_chat_agent()
        # Ensure agent is initialized if needed? 
        # Usually get_chat_agent returns a singleton or new instance.
        
        response = await agent.process_message(request.message, sender="DashboardUser")
        return {"response": response}
    except Exception as e:
        logger.error(f"Chat Error: {e}")
        return {"response": "I'm having trouble connecting to my brain right now. Please try again."}

@app.get("/health")
def health():
    return {"status": "ok"}

if __name__ == "__main__":
    print("🚀 Chat Server running on http://localhost:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)
