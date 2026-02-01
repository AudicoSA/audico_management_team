from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from src.agents.chat_agent import get_chat_agent, ChatAgent
from src.utils.logging import AgentLogger

router = APIRouter(prefix="/chat", tags=["chat"])
logger = AgentLogger("ChatAPI")

class ChatRequest(BaseModel):
    message: str

@router.post("/")
async def chat_endpoint(request: ChatRequest):
    """
    Chat with Kait (Internal Staff Agent).
    """
    import time
    start_time = time.time()
    logger.info("chat_request_received", message=request.message)
    
    try:
        agent = get_chat_agent()
        response = await agent.process_message(request.message)
        
        duration = time.time() - start_time
        logger.info("chat_response_generated", duration=round(duration, 2))
        
        return {"response": response}
    except Exception as e:
        logger.error("chat_endpoint_failed", error=str(e), exc_info=True)
        # Return a friendly error instead of 500 to keep UI smooth
        return {"response": "I'm having trouble connecting to my brain right now. Please try again."}
