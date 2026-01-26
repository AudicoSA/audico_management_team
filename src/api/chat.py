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
    try:
        agent = get_chat_agent()
        response = await agent.process_message(request.message)
        return {"response": response}
    except Exception as e:
        logger.error("chat_endpoint_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))
