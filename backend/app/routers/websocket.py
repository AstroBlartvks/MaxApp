from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Request, HTTPException
from fastapi.responses import JSONResponse
from typing import Dict
import json

from app.logging_config import app_logger

router = APIRouter(
    prefix="/ws",
    tags=["WebSockets"]
)

# Add GET endpoint for diagnostics - if someone tries to access WebSocket via HTTP GET
@router.get("/connect")
async def websocket_get_diagnostic(request: Request):
    """
    Diagnostic endpoint - returns error if WebSocket endpoint is accessed via HTTP GET.
    This indicates that nginx/proxy is not configured correctly for WebSocket.
    """
    app_logger.error(
        f"WebSocket endpoint accessed via HTTP GET from {request.client.host if request.client else 'unknown'}. "
        f"This indicates that nginx/proxy is not configured for WebSocket upgrade. "
        f"Headers: {dict(request.headers)}"
    )
    return JSONResponse(
        status_code=426,
        content={
            "error": "Upgrade Required",
            "message": "This endpoint requires WebSocket protocol. The request was received as HTTP GET, which indicates that the proxy/nginx is not configured for WebSocket upgrade.",
            "solution": "Configure nginx to pass WebSocket upgrade headers. See WEBSOCKET_SETUP.md for details.",
            "headers_received": dict(request.headers)
        }
    )

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, WebSocket] = {} # Map user_id to WebSocket

    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        self.active_connections[user_id] = websocket
        app_logger.info(f"WebSocket connected for user_id: {user_id}")

    def disconnect(self, user_id: int):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
            app_logger.info(f"WebSocket disconnected for user_id: {user_id}")

    async def send_personal_message(self, message: str, user_id: int):
        if user_id in self.active_connections:
            try:
                # Ensure message is a string (JSON if it's a dict)
                if isinstance(message, dict):
                    message = json.dumps(message)
                await self.active_connections[user_id].send_text(message)
                app_logger.info(f"Sent message to user_id {user_id}: {message}")
            except Exception as e:
                app_logger.error(f"Error sending message to user_id {user_id}: {e}", exc_info=e)
                # Remove broken connection
                if user_id in self.active_connections:
                    del self.active_connections[user_id]
        else:
            app_logger.warning(f"Attempted to send message to disconnected user_id: {user_id}")

manager = ConnectionManager()

@router.websocket("/connect")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for real-time notifications.
    Requires user_id as query parameter: /ws/connect?user_id=123456
    """
    client_host = websocket.client.host if websocket.client else "unknown"
    app_logger.info(f"WebSocket connection attempt from {client_host}")
    
    # Log headers for debugging
    headers = dict(websocket.headers)
    app_logger.debug(f"WebSocket headers: {headers}")
    
    # Get user_id from query parameters
    user_id_param = websocket.query_params.get("user_id")
    
    if not user_id_param or not user_id_param.isdigit():
        app_logger.warning(f"WebSocket connection rejected: invalid user_id parameter '{user_id_param}' from {client_host}")
        try:
            await websocket.close(code=1008, reason="Missing or invalid user_id parameter")
        except Exception as e:
            app_logger.error(f"Error closing WebSocket: {e}")
        return
    
    user_id = int(user_id_param)
    
    try:
        app_logger.info(f"Accepting WebSocket connection for user_id: {user_id}")
        await manager.connect(websocket, user_id)
        app_logger.info(f"WebSocket connection established for user_id: {user_id}")
        
        # Keep the connection alive and handle incoming messages
        while True:
            # Wait for messages from client (ping/pong or other messages)
            data = await websocket.receive_text()
            # Echo back or handle client messages if needed
            # For now, we just keep the connection alive
            app_logger.debug(f"Received message from user_id {user_id}: {data}")
            
    except WebSocketDisconnect:
        app_logger.info(f"WebSocket disconnected normally for user_id: {user_id}")
        manager.disconnect(user_id)
    except Exception as e:
        app_logger.error(f"WebSocket error for user_id {user_id}: {e}", exc_info=True)
        manager.disconnect(user_id)
        try:
            await websocket.close(code=1011, reason=f"Internal server error: {str(e)}")
        except Exception as close_error:
            app_logger.error(f"Error closing WebSocket after error: {close_error}")
