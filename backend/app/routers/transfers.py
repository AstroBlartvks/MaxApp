import os
from fastapi import APIRouter, Depends, HTTPException, status
from typing import Dict
import asyncpg
from uuid import UUID
from dotenv import load_dotenv

from app.security import get_current_user
from app.schemas import InitiateTransferRequest, User
from postgresql import database as db
from app.routers.websocket import manager # Import the WebSocket manager
from app.logging_config import app_logger

# Загружаем переменные окружения
load_dotenv()

BASE_URL = os.getenv("BASE_URL", "https://api.whitea.cloud")

router = APIRouter(
    prefix="/api/transfers",
    tags=["Transfers"],
    dependencies=[Depends(get_current_user)]
)

@router.post("/initiate", status_code=status.HTTP_201_CREATED)
async def initiate_transfer(
    request: InitiateTransferRequest,
    current_user: User = Depends(get_current_user), # This is the Scanner/Receiver
    conn: asyncpg.Connection = Depends(db.get_connection)
):
    """
    Instantly transfers (copies) a photo to the scanner.
    Called by the Scanner's device after scanning the Sharer's photo QR code.
    """
    receiver_id = current_user.id
    photo_file_id = request.photo_file_id
    
    app_logger.info(f"Transfer initiated: receiver_id={receiver_id}, photo_file_id={photo_file_id}")
    
    # 1. Find the photo by file_id
    photo = await conn.fetchrow("SELECT * FROM art_objects WHERE file_id = $1", photo_file_id)
    if not photo:
        app_logger.error(f"Photo not found: {photo_file_id}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Photo not found.")
    
    owner_id = photo["owner_id"]
    app_logger.info(f"Photo found: owner_id={owner_id}")
    
    if owner_id == receiver_id:
        app_logger.warning(f"User {receiver_id} tried to transfer their own photo")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You already own this photo.")
    
    # 2. Check if receiver already has this photo
    existing_photo = await conn.fetchrow(
        "SELECT * FROM art_objects WHERE file_id = $1 AND owner_id = $2",
        photo_file_id, receiver_id
    )
    if existing_photo:
        app_logger.warning(f"User {receiver_id} already has photo {photo_file_id}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You already have this photo.")
    
    # 3. Create a copy of the photo for the receiver (same file_id, different owner)
    new_photo = await db.create_art_object(conn, owner_id=receiver_id, file_name=photo_file_id)
    app_logger.info(f"Photo copied: new_id={new_photo['id']}, receiver_id={receiver_id}")
    
    # 4. Notify both users via WebSocket
    receiver_user = await db.get_user_by_id(conn, receiver_id)
    receiver_username = receiver_user["username"] if receiver_user and receiver_user["username"] else f"User {receiver_id}"
    
    owner_user = await db.get_user_by_id(conn, owner_id)
    owner_username = owner_user["username"] if owner_user and owner_user["username"] else f"User {owner_id}"
    
    # Notify owner
    owner_message = {
        "type": "transfer_completed",
        "message": f"{receiver_username} получил вашу фотографию.",
        "photo_url": f"{BASE_URL}/uploads/{photo_file_id}"
    }
    await manager.send_personal_message(message=owner_message, user_id=owner_id)
    app_logger.info(f"Notified owner {owner_id}")
    
    # Notify receiver
    receiver_message = {
        "type": "transfer_completed",
        "message": f"Фотография от {owner_username} добавлена в вашу коллекцию!",
        "photo_id": new_photo["id"],
        "photo_url": f"{BASE_URL}/uploads/{photo_file_id}"
    }
    await manager.send_personal_message(message=receiver_message, user_id=receiver_id)
    app_logger.info(f"Notified receiver {receiver_id}")
    
    return {
        "message": "Photo transferred successfully.",
        "photo": {
            "id": new_photo["id"],
            "url": f"{BASE_URL}/uploads/{photo_file_id}",
            "file_id": photo_file_id,
            "created_at": new_photo["created_at"]
        }
    }

@router.post("/confirm", status_code=status.HTTP_200_OK)
async def confirm_transfer(
    transfer_id: UUID,
    accept: bool,
    current_user: User = Depends(get_current_user), # This is the Sharer
    conn: asyncpg.Connection = Depends(db.get_connection)
):
    """
    Confirms or rejects a photo ownership transfer request.
    Called by the Sharer's device.
    """
    sharer_id = current_user.id

    # 1. Get the pending transfer
    pending_transfer = await db.get_pending_transfer(conn, str(transfer_id))
    if not pending_transfer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transfer request not found.")
    
    if pending_transfer["sharer_id"] != sharer_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to confirm this transfer.")
    
    if pending_transfer["status"] != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Transfer request is already {pending_transfer['status']}.")

    photo_id = pending_transfer["photo_id"]
    scanner_id = pending_transfer["scanner_id"]

    if accept:
        # 2. Update photo owner
        updated_photo = await db.update_art_object_owner(conn, photo_id, scanner_id)
        if not updated_photo:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update photo owner.")
        
        # 3. Update transfer status
        await db.update_pending_transfer_status(conn, str(transfer_id), "accepted")

        # 4. Notify both Sharer and Scanner
        sharer_message = {"type": "transfer_status", "transfer_id": str(transfer_id), "status": "accepted", "message": "Вы успешно передали фотографию."}
        scanner_message = {"type": "transfer_status", "transfer_id": str(transfer_id), "status": "accepted", "message": "Вы получили фотографию!", "photo_id": photo_id, "photo_url": f"{BASE_URL}/uploads/{updated_photo['file_id']}"}
        
        await manager.send_personal_message(message=sharer_message, user_id=sharer_id)
        await manager.send_personal_message(message=scanner_message, user_id=scanner_id)

        return {"message": "Transfer accepted and photo ownership updated."}
    else:
        # 2. Update transfer status to rejected
        await db.update_pending_transfer_status(conn, str(transfer_id), "rejected")

        # 3. Notify both Sharer and Scanner
        sharer_message = {"type": "transfer_status", "transfer_id": str(transfer_id), "status": "rejected", "message": "Вы отклонили передачу фотографии."}
        scanner_message = {"type": "transfer_status", "transfer_id": str(transfer_id), "status": "rejected", "message": "Передача фотографии отклонена."}
        
        await manager.send_personal_message(message=sharer_message, user_id=sharer_id)
        await manager.send_personal_message(message=scanner_message, user_id=scanner_id)

        return {"message": "Transfer rejected."}
