from fastapi import APIRouter, Depends, HTTPException, status, Body
from uuid import UUID
from typing import List
import asyncpg
import logging
import secrets
import string
import json

from app.security import get_current_user
from app.schemas import User
from postgresql.database import get_connection

logger = logging.getLogger(__name__)

async def notify_trade_confirmed(sender_id: int, receiver_id: int):
    from app.routers.websocket import manager
    message_sender = json.dumps({
        "type": "materials_updated",
        "message": "Материалы обновлены"
    })
    message_receiver = json.dumps({
        "type": "materials_updated",
        "message": "Материалы обновлены"
    })
    await manager.send_personal_message(message_sender, sender_id)
    await manager.send_personal_message(message_receiver, receiver_id)

def generate_share_token(length: int = 8) -> str:
    """Generate a random alphanumeric token for sharing."""
    alphabet = string.ascii_uppercase + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))

router = APIRouter(
    prefix="/trades",
    tags=["trades"],
)

@router.post("/create-share")
async def create_share_trades(
    art_object_ids: List[int] = Body(..., embed=True),
    current_user: User = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_connection),
):
    """Create multiple trades with a single share token for QR code."""
    if not art_object_ids or len(art_object_ids) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one art object ID is required.",
        )

    # Check ownership of all art objects
    owned_objects = await conn.fetch(
        "SELECT id FROM art_objects WHERE id = ANY($1) AND owner_id = $2",
        art_object_ids,
        current_user.id,
    )

    if len(owned_objects) != len(art_object_ids):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not own all of the specified art objects.",
        )

    async with conn.transaction():
        # Не отменяем старые трейды - позволяем пользователю иметь несколько активных share tokens
        # Трейды автоматически истекают через expires_at

        # Generate unique share token
        share_token = generate_share_token()

        # Ensure token is unique
        while await conn.fetchval("SELECT 1 FROM trades WHERE share_token = $1", share_token):
            share_token = generate_share_token()

        # Create trades with the share token
        trades_created = []
        for art_object_id in art_object_ids:
            trade = await conn.fetchrow(
                """
                INSERT INTO trades (art_object_id, sender_id, share_token)
                VALUES ($1, $2, $3)
                RETURNING id, expires_at
                """,
                art_object_id,
                current_user.id,
                share_token,
            )
            if trade:
                trades_created.append(trade["id"])

        if len(trades_created) == 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Could not create trades.",
            )

        logger.info(f"Created {len(trades_created)} trades with share token {share_token} for user {current_user.id}")

        return {
            "share_token": share_token,
            "trade_count": len(trades_created),
            "expires_at": trades_created[0] if trades_created else None
        }


@router.post("/initiate")
async def initiate_trade(
    art_object_id: int,
    current_user: User = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_connection),
):
    """Initiate a trade for a single art object (legacy endpoint)."""
    async with conn.transaction():
        # Check if the user owns the art object
        owner = await conn.fetchval(
            "SELECT owner_id FROM art_objects WHERE id = $1", art_object_id
        )
        if owner != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not own this art object.",
            )

        # Отменить все старые pending трейды от этого пользователя
        cancelled_count = await conn.execute(
            """
            UPDATE trades
            SET status = 'rejected'
            WHERE sender_id = $1 AND status IN ('pending', 'scanned')
            AND expires_at > NOW()
            """,
            current_user.id
        )
        if cancelled_count:
            logger.info(f"Cancelled {cancelled_count} old trades for user {current_user.id}")

        # Generate share token for single trade too
        share_token = generate_share_token()
        while await conn.fetchval("SELECT 1 FROM trades WHERE share_token = $1", share_token):
            share_token = generate_share_token()

        # Create a new trade record
        trade = await conn.fetchrow(
            """
            INSERT INTO trades (art_object_id, sender_id, share_token)
            VALUES ($1, $2, $3)
            RETURNING id, expires_at
            """,
            art_object_id,
            current_user.id,
            share_token,
        )
        if not trade:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Could not initiate trade.",
            )

        return {"trade_id": trade["id"], "share_token": share_token, "expires_at": trade["expires_at"]}


@router.get("/scanned")
async def get_scanned_trades(
    current_user: User = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_connection),
):
    """Get a list of trades where the user is the SENDER and they have been scanned by others."""
    try:
        logger.info(f"Loading scanned trades for user {current_user.id} (as sender)")

        trades = await conn.fetch(
            """
            SELECT
                t.id as trade_id,
                t.art_object_id,
                t.sender_id,
                t.receiver_id,
                t.status,
                t.created_at,
                t.expires_at,
                ao.file_id
            FROM trades t
            LEFT JOIN art_objects ao ON t.art_object_id = ao.id
            WHERE t.sender_id = $1 AND t.status = 'scanned'
            ORDER BY t.created_at DESC
            """,
            current_user.id,
        )

        result = [dict(trade) for trade in trades]
        logger.info(f"Found {len(result)} scanned trades for user {current_user.id} as sender")
        return result

    except Exception as e:
        logger.error(f"Error loading scanned trades for user {current_user.id}: {e}", exc_info=True)
        # Возвращаем пустой список вместо ошибки
        return []


@router.get("/{trade_id}")
async def get_trade_status(
    trade_id: UUID,
    current_user: User = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_connection),
):
    """Get the status of a trade."""
    trade = await conn.fetchrow("SELECT * FROM trades WHERE id = $1", trade_id)
    if not trade:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Trade not found."
        )

    # Users can only get the status of their own trades
    if current_user.id not in (trade["sender_id"], trade["receiver_id"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not part of this trade.",
        )

    return dict(trade)


@router.post("/scan-share/{share_token}")
async def scan_share_token(
    share_token: str,
    current_user: User = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_connection),
):
    """Scan trades by share token and become the receiver for all."""
    async with conn.transaction():
        # First, check if trades with this token exist at all
        all_trades = await conn.fetch(
            """
            SELECT * FROM trades
            WHERE share_token = $1
            ORDER BY created_at DESC
            """,
            share_token
        )
        
        if not all_trades or len(all_trades) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No trades found with this share token. The QR code may be invalid or expired."
            )
        
        # Check if user already received these trades
        completed_for_user = [t for t in all_trades if t["receiver_id"] == current_user.id and t["status"] == "completed"]
        if completed_for_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"You have already received these {len(completed_for_user)} photo(s)."
            )
        
        # Find pending trades with this share token
        trades = await conn.fetch(
            """
            SELECT * FROM trades
            WHERE share_token = $1 AND status = 'pending'
            FOR UPDATE
            """,
            share_token
        )

        if not trades or len(trades) == 0:
            # Check if they were completed by someone else
            completed_trades = [t for t in all_trades if t["status"] == "completed"]
            if completed_trades:
                raise HTTPException(
                    status_code=status.HTTP_410_GONE,
                    detail="This QR code has already been used by another person."
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="No pending trades found with this share token."
                )

        # Check if user is trying to scan their own trades
        sender_id = trades[0]["sender_id"]
        if sender_id == current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot scan your own trade."
            )

        # Отменить все другие активные трейды между этими пользователями
        # Это гарантирует, что между пользователями может быть только один активный трейд
        trade_ids_to_keep = [trade["id"] for trade in trades]
        if trade_ids_to_keep:
            cancelled_count = await conn.execute(
                """
                UPDATE trades
                SET status = 'rejected'
                WHERE (
                    (sender_id = $1 AND receiver_id = $2) 
                    OR (sender_id = $2 AND receiver_id = $1)
                    OR (sender_id = $1 AND receiver_id IS NULL)
                    OR (sender_id = $2 AND receiver_id IS NULL)
                )
                AND status IN ('pending', 'scanned')
                AND NOT (id = ANY($3::uuid[]))
                AND expires_at > NOW()
                """,
                sender_id,
                current_user.id,
                trade_ids_to_keep
            )
            if cancelled_count:
                logger.info(f"Cancelled {cancelled_count} old trades between users {sender_id} and {current_user.id}")

        # Update all trades to scanned and immediately complete them
        scanned_count = 0
        completed_trades = []
        
        for trade in trades:
            # Update to completed status and set receiver
            await conn.execute(
                """
                UPDATE trades
                SET status = 'completed', receiver_id = $1
                WHERE id = $2
                """,
                current_user.id,
                trade["id"]
            )
            
            # Transfer ownership immediately
            await conn.execute(
                "UPDATE art_objects SET owner_id = $1 WHERE id = $2",
                current_user.id,
                trade["art_object_id"],
            )
            
            # Log the ownership transfer
            await conn.execute(
                """
                INSERT INTO ownership_history (art_object_id, from_user_id, to_user_id, transaction_type)
                VALUES ($1, $2, $3, 'transfer')
                """,
                trade["art_object_id"],
                sender_id,
                current_user.id,
            )
            
            completed_trades.append(str(trade["id"]))
            scanned_count += 1

        logger.info(f"User {current_user.id} scanned and auto-completed {scanned_count} trades with token {share_token}")
        
        # Notify both users
        await notify_trade_confirmed(sender_id, current_user.id)

        # Return the trade IDs that were just completed
        return {
            "message": f"Successfully received {scanned_count} photos",
            "trade_count": scanned_count,
            "trade_ids": completed_trades
        }


@router.post("/{trade_id}/scan")
async def scan_trade(
    trade_id: UUID,
    current_user: User = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_connection),
):
    """Scan a single trade QR code and become the receiver (legacy endpoint)."""
    async with conn.transaction():
        # Lock the trade row for update
        trade = await conn.fetchrow(
            "SELECT * FROM trades WHERE id = $1 FOR UPDATE", trade_id
        )
        if not trade:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Trade not found."
            )

        if trade["status"] != "pending":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This trade is no longer pending.",
            )
        
        sender_id = trade["sender_id"]
        if sender_id == current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot trade with yourself.",
            )

        if trade["receiver_id"] is not None and trade["receiver_id"] != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Another user has already scanned this trade.",
            )

        # Отменить все другие активные трейды между этими пользователями
        # Это гарантирует, что между пользователями может быть только один активный трейд
        cancelled_count = await conn.execute(
            """
            UPDATE trades
            SET status = 'rejected'
            WHERE (
                (sender_id = $1 AND receiver_id = $2) 
                OR (sender_id = $2 AND receiver_id = $1)
                OR (sender_id = $1 AND receiver_id IS NULL)
                OR (sender_id = $2 AND receiver_id IS NULL)
            )
            AND status IN ('pending', 'scanned')
            AND id != $3
            AND expires_at > NOW()
            """,
            sender_id,
            current_user.id,
            trade_id
        )
        if cancelled_count:
            logger.info(f"Cancelled {cancelled_count} old trades between users {sender_id} and {current_user.id}")

        # Update the receiver_id
        await conn.execute(
            "UPDATE trades SET receiver_id = $1, status = 'scanned' WHERE id = $2",
            current_user.id,
            trade_id,
        )

    return {"message": "Trade scanned successfully. Waiting for sender to confirm."}


@router.post("/{trade_id}/confirm")
async def confirm_trade(
    trade_id: UUID,
    current_user: User = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_connection),
):
    """Confirm the trade and transfer ownership."""
    async with conn.transaction():
        trade = await conn.fetchrow(
            "SELECT * FROM trades WHERE id = $1 FOR UPDATE", trade_id
        )
        if not trade:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Trade not found."
            )

        if trade["sender_id"] != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the sender can confirm the trade.",
            )

        if trade["status"] != "scanned":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Trade is not in a scannable state.",
            )

        # Update art object owner
        await conn.execute(
            "UPDATE art_objects SET owner_id = $1 WHERE id = $2",
            trade["receiver_id"],
            trade["art_object_id"],
        )

        # Update trade status
        await conn.execute(
            "UPDATE trades SET status = 'completed' WHERE id = $1", trade_id
        )

        # Log the ownership transfer
        await conn.execute(
            """
            INSERT INTO ownership_history (art_object_id, from_user_id, to_user_id, transaction_type)
            VALUES ($1, $2, $3, 'transfer')
            """,
            trade["art_object_id"],
            trade["sender_id"],
            trade["receiver_id"],
        )

    await notify_trade_confirmed(trade["sender_id"], trade["receiver_id"])
    return {"message": "Trade confirmed and ownership transferred."}


@router.post("/{trade_id}/reject")
async def reject_trade(
    trade_id: UUID,
    current_user: User = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_connection),
):
    """Reject the trade."""
    async with conn.transaction():
        trade = await conn.fetchrow(
            "SELECT * FROM trades WHERE id = $1 FOR UPDATE", trade_id
        )
        if not trade:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Trade not found."
            )

        if trade["sender_id"] != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the sender can reject the trade.",
            )

        if trade["status"] not in ("pending", "scanned"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This trade cannot be rejected.",
            )

        # Update trade status
        await conn.execute(
            "UPDATE trades SET status = 'rejected' WHERE id = $1", trade_id
        )

    await notify_trade_confirmed(trade["sender_id"], trade["receiver_id"])
    return {"message": "Trade rejected."}