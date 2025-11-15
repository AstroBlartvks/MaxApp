import os
from fastapi import APIRouter, Depends, HTTPException, status, Body
from uuid import UUID
from typing import List, Optional
import asyncpg
import logging
import json
from dotenv import load_dotenv

from app.security import get_current_user
from app.schemas import User
from postgresql.database import get_connection

# Загружаем переменные окружения
load_dotenv()

BASE_URL = os.getenv("BASE_URL", "https://api.whitea.cloud")

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/profile-requests",
    tags=["profile_requests"],
)

@router.get("/public/{user_id}")
async def get_public_profile(
    user_id: int,
    conn: asyncpg.Connection = Depends(get_connection),
):
    """
    Get public profile information. No authentication required.
    Returns user info and public photos if profile is public.
    """
    logger.info(f"Public profile request for user_id: {user_id}")
    
    # Get user info
    user = await conn.fetchrow(
        "SELECT id, first_name, last_name, username, photo_url, is_public_profile, contact_link FROM users WHERE id = $1",
        user_id
    )
    
    if not user:
        logger.warning(f"User {user_id} not found")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )
    
    logger.info(f"User {user_id} found, is_public_profile: {user.get('is_public_profile', False)}")
    
    # If profile is not public, return limited info
    if not user.get("is_public_profile", False):
        return {
            "user": {
                "id": user["id"],
                "first_name": user["first_name"],
                "last_name": user["last_name"],
                "username": user["username"],
                "photo_url": user["photo_url"],
                "is_public_profile": False,
                "contact_link": user.get("contact_link")
            },
            "photos": [],
            "message": "This profile is private. Please use the app to request access."
        }
    
    # Get all photos for public profile
    photos = await conn.fetch(
        """
        SELECT id, file_id, created_at, description, tags, is_public
        FROM art_objects
        WHERE owner_id = $1
        ORDER BY created_at DESC
        """,
        user_id
    )
    
    logger.info(f"Found {len(photos)} photos for user {user_id}")
    
    base_url = BASE_URL
    
    return {
        "user": {
            "id": user["id"],
            "first_name": user["first_name"],
            "last_name": user["last_name"],
            "username": user["username"],
            "photo_url": user["photo_url"],
            "is_public_profile": True,
            "contact_link": user.get("contact_link")
        },
        "photos": [
            {
                "id": photo["id"],
                "url": f"{base_url}/uploads/{photo['file_id']}",
                "file_id": photo["file_id"],
                "created_at": photo["created_at"],
                "description": photo.get("description"),
                "tags": photo.get("tags") or [],
            }
            for photo in photos
        ]
    }

async def notify_profile_request(requester_id: int, target_id: int, request_id: str):
    from app.routers.websocket import manager
    message = json.dumps({
        "type": "profile_view_request",
        "requester_id": requester_id,
        "request_id": request_id,
        "message": "Пользователь запрашивает доступ к вашему профилю"
    })
    await manager.send_personal_message(message, target_id)

async def notify_profile_response(target_id: int, requester_id: int, approved: bool, photo_ids: Optional[List[int]], request_id: Optional[str] = None, is_update: bool = False, old_photo_ids: Optional[List[int]] = None, target_user_name: Optional[str] = None):
    from app.routers.websocket import manager
    if approved:
        message = json.dumps({
            "type": "profile_view_approved",
            "target_id": target_id,
            "request_id": request_id,
            "photo_ids": photo_ids or [],
            "is_update": is_update,
            "old_photo_ids": old_photo_ids or [],
            "target_user_name": target_user_name,
            "message": "Запрос на просмотр профиля одобрен" if not is_update else "Разрешение на просмотр профиля обновлено"
        })
    else:
        message = json.dumps({
            "type": "profile_view_rejected",
            "target_id": target_id,
            "request_id": request_id,
            "target_user_name": target_user_name,
            "message": "Запрос на просмотр профиля отклонен"
        })
    await manager.send_personal_message(message, requester_id)

async def notify_materials_updated(user_id: int):
    from app.routers.websocket import manager
    message = json.dumps({
        "type": "materials_updated",
        "message": "Материалы обновлены"
    })
    await manager.send_personal_message(message, user_id)

@router.get("/user/{user_id}")
async def get_user_info(
    user_id: int,
    current_user: User = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_connection),
):
    """Get public user information by user ID."""
    user = await conn.fetchrow(
        "SELECT id, first_name, last_name, username, photo_url, is_public_profile FROM users WHERE id = $1",
        user_id
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )
    
    return {
        "id": user["id"],
        "first_name": user["first_name"],
        "last_name": user["last_name"],
        "username": user["username"],
        "photo_url": user["photo_url"],
        "is_public_profile": user.get("is_public_profile", False)
    }

@router.post("/create")
async def create_profile_request(
    target_user_id: int = Body(..., embed=True),
    current_user: User = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_connection),
):
    if target_user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot request access to your own profile."
        )

    target_user = await conn.fetchrow(
        "SELECT * FROM users WHERE id = $1", target_user_id
    )
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target user not found."
        )

    async with conn.transaction():
        # Сначала проверим, есть ли уже активный pending запрос
        existing_request = await conn.fetchrow(
            """
            SELECT id, created_at, expires_at
            FROM profile_view_requests
            WHERE requester_id = $1 AND target_id = $2
            AND status = 'pending'
            AND expires_at > NOW()
            """,
            current_user.id,
            target_user_id
        )
        
        if existing_request:
            # Если есть активный pending запрос, вернуть его вместо создания нового
            logger.info(f"Returning existing pending profile request: {existing_request['id']} from {current_user.id} to {target_user_id}")
            return {
                "request_id": str(existing_request["id"]),
                "created_at": existing_request["created_at"],
                "expires_at": existing_request["expires_at"]
            }
        
        # Отменить только старые PENDING запросы в том же направлении (от current_user к target_user_id)
        # НЕ отменяем одобренные (approved) запросы - они остаются активными
        # Это гарантирует, что может быть только один pending запрос от одного пользователя к другому
        # Но одобренные разрешения сохраняются при повторном сканировании QR
        cancelled_count = await conn.execute(
            """
            UPDATE profile_view_requests
            SET status = 'rejected'
            WHERE requester_id = $1 AND target_id = $2
            AND status = 'pending'
            AND expires_at > NOW()
            """,
            current_user.id,
            target_user_id
        )
        if cancelled_count:
            logger.info(f"Cancelled {cancelled_count} old pending profile requests from user {current_user.id} to user {target_user_id}")

        # Создать новый запрос (старые уже отменены, поэтому можно создавать новый)
        request = await conn.fetchrow(
            """
            INSERT INTO profile_view_requests (requester_id, target_id)
            VALUES ($1, $2)
            RETURNING id, created_at, expires_at
            """,
            current_user.id,
            target_user_id
        )

        await notify_profile_request(current_user.id, target_user_id, str(request["id"]))

        logger.info(f"Profile view request created: {request['id']} from {current_user.id} to {target_user_id}")

        return {
            "request_id": str(request["id"]),
            "created_at": request["created_at"],
            "expires_at": request["expires_at"]
        }

@router.get("/pending")
async def get_pending_requests(
    current_user: User = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_connection),
):
    requests = await conn.fetch(
        """
        SELECT
            pvr.id,
            pvr.requester_id,
            pvr.created_at,
            pvr.expires_at,
            u.first_name,
            u.last_name,
            u.username
        FROM profile_view_requests pvr
        JOIN users u ON pvr.requester_id = u.id
        WHERE pvr.target_id = $1 AND pvr.status = 'pending' AND pvr.expires_at > NOW()
        ORDER BY pvr.created_at DESC
        """,
        current_user.id
    )

    return [dict(r) for r in requests]

@router.post("/{request_id}/respond")
async def respond_to_request(
    request_id: UUID,
    approved: bool = Body(...),
    photo_ids: List[int] = Body(default=[]),
    current_user: User = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_connection),
):
    async with conn.transaction():
        request = await conn.fetchrow(
            """
            SELECT * FROM profile_view_requests
            WHERE id = $1 AND target_id = $2
            FOR UPDATE
            """,
            request_id,
            current_user.id
        )

        if not request:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Request not found."
            )

        if request["status"] != "pending":
            # Получить информацию о том, кто уже ответил на запрос
            logger.warning(f"Attempt to respond to non-pending request {request_id}: current status is {request['status']}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Request has already been responded to. Current status: {request['status']}"
            )

        if approved:
            # Если одобряется запрос, но не выбраны фото - отклонить
            if not photo_ids or len(photo_ids) == 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="You must select at least one photo to approve the request."
                )
            
            # Проверить, что все выбранные фото принадлежат пользователю
            photos = await conn.fetch(
                "SELECT id FROM art_objects WHERE id = ANY($1) AND owner_id = $2",
                photo_ids,
                current_user.id
            )

            if len(photos) != len(photo_ids):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You do not own all of the specified photos."
                )

        new_status = "approved" if approved else "rejected"
        selected_ids = photo_ids if approved else []

        await conn.execute(
            """
            UPDATE profile_view_requests
            SET status = $1, selected_photo_ids = $2
            WHERE id = $3
            """,
            new_status,
            selected_ids,
            request_id
        )

        # Получить имя пользователя для уведомления
        user_info = await conn.fetchrow(
            "SELECT first_name, last_name FROM users WHERE id = $1",
            current_user.id
        )
        target_user_name = None
        if user_info:
            first_name = user_info["first_name"] or ""
            last_name = user_info["last_name"] or ""
            target_user_name = f"{first_name} {last_name}".strip() or None

        await notify_profile_response(
            current_user.id,
            request["requester_id"],
            approved,
            selected_ids,
            str(request_id),
            target_user_name=target_user_name
        )

        logger.info(f"Profile request {request_id} {new_status} by user {current_user.id}")

        return {
            "message": f"Request {new_status}",
            "photo_count": len(selected_ids) if approved else 0
        }

@router.get("/user/{user_id}/request-status")
async def get_request_status(
    user_id: int,
    current_user: User = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_connection),
):
    """Get the status of the most recent profile view request from current user to target user."""
    request = await conn.fetchrow(
        """
        SELECT id, status, created_at, expires_at
        FROM profile_view_requests
        WHERE target_id = $1 AND requester_id = $2
        ORDER BY created_at DESC
        LIMIT 1
        """,
        user_id,
        current_user.id
    )
    
    if not request:
        return {"has_request": False, "status": None}
    
    return {
        "has_request": True,
        "status": request["status"],
        "request_id": str(request["id"]),
        "created_at": request["created_at"],
        "expires_at": request["expires_at"]
    }

@router.get("/user/{user_id}/approved-photos")
async def get_user_approved_photos(
    user_id: int,
    current_user: User = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_connection),
):
    """
    Get all public photos and approved photos from a specific user.
    If user has public profile, returns ALL photos. Otherwise returns public + approved.
    """
    # Check if the target user has a public profile
    target_user = await conn.fetchrow(
        "SELECT is_public_profile FROM users WHERE id = $1",
        user_id
    )
    
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )
    
    has_public_profile = target_user.get("is_public_profile", False)
    
    # If user has public profile, return ALL their photos
    if has_public_profile:
        photos = await conn.fetch(
            """
            SELECT id, file_id, created_at, description, tags, is_public
            FROM art_objects
            WHERE owner_id = $1
            ORDER BY created_at DESC
            """,
            user_id
        )
        
        logger.info(f"User {user_id} has public profile, returning all {len(photos)} photos")
    else:
        # Original logic: return public + approved photos
        # Получить все публичные фотографии пользователя (доступны ВСЕГДА)
        public_photos = await conn.fetch(
            """
            SELECT id, file_id, created_at, description, tags, is_public
            FROM art_objects
            WHERE owner_id = $1 AND is_public = TRUE
            ORDER BY created_at DESC
            """,
            user_id
        )
        
        public_photo_ids = [photo["id"] for photo in public_photos]
        
        # Найти одобренные запросы (дополнительные фото с разрешением)
        approved_requests = await conn.fetch(
            """
            SELECT selected_photo_ids, created_at
            FROM profile_view_requests
            WHERE target_id = $1 AND requester_id = $2 AND status = 'approved'
            AND selected_photo_ids IS NOT NULL AND array_length(selected_photo_ids, 1) > 0
            AND expires_at > NOW()
            ORDER BY created_at DESC
            """,
            user_id,
            current_user.id
        )

        # Собрать photo_ids из одобренных запросов (НЕ публичные)
        approved_photo_ids = []
        for req in approved_requests:
            if req["selected_photo_ids"]:
                approved_photo_ids.extend(req["selected_photo_ids"])
        
        # Убрать дубликаты
        approved_photo_ids = list(set(approved_photo_ids))
        
        # Объединить публичные и одобренные photo IDs
        all_photo_ids = list(set(public_photo_ids + approved_photo_ids))
        
        if not all_photo_ids:
            logger.info(f"No public or approved photos found for user {current_user.id} viewing profile {user_id}")
            return []

        logger.info(f"Returning {len(all_photo_ids)} photos for user {current_user.id} from user {user_id}: {len(public_photo_ids)} public + {len(approved_photo_ids)} approved")

        # Получить все фотографии
        photos = await conn.fetch(
            """
            SELECT id, file_id, created_at, description, tags, is_public
            FROM art_objects
            WHERE id = ANY($1) AND owner_id = $2
            ORDER BY created_at DESC
            """,
            all_photo_ids,
            user_id
        )

    logger.info(f"Found {len(photos)} photos matching the IDs")

    base_url = BASE_URL

    return [
        {
            "id": photo["id"],
            "url": f"{base_url}/uploads/{photo['file_id']}",
            "file_id": photo["file_id"],
            "created_at": photo["created_at"],
            "description": photo.get("description"),
            "tags": photo.get("tags") or [],
            "is_public": photo.get("is_public", False),
            "from_public_profile": has_public_profile
        }
        for photo in photos
    ]

@router.get("/{request_id}/photos")
async def get_approved_photos(
    request_id: UUID,
    current_user: User = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_connection),
):
    request = await conn.fetchrow(
        """
        SELECT * FROM profile_view_requests
        WHERE id = $1 AND requester_id = $2
        """,
        request_id,
        current_user.id
    )

    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request not found."
        )

    if request["status"] != "approved":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Request has not been approved."
        )

    photo_ids = request["selected_photo_ids"]
    if not photo_ids:
        return []

    photos = await conn.fetch(
        """
        SELECT id, file_id, created_at
        FROM art_objects
        WHERE id = ANY($1)
        """,
        photo_ids
    )

    base_url = BASE_URL

    return [
        {
            "id": photo["id"],
            "url": f"{base_url}/uploads/{photo['file_id']}",
            "file_id": photo["file_id"],
            "created_at": photo["created_at"]
        }
        for photo in photos
    ]

@router.get("/my-permissions")
async def get_my_permissions(
    current_user: User = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_connection),
):
    """Get all approved profile view requests where current user is the target (gave permissions)."""
    requests = await conn.fetch(
        """
        SELECT
            pvr.id,
            pvr.requester_id,
            pvr.status,
            pvr.selected_photo_ids,
            pvr.created_at,
            pvr.expires_at,
            u.first_name,
            u.last_name,
            u.username,
            u.photo_url
        FROM profile_view_requests pvr
        JOIN users u ON pvr.requester_id = u.id
        WHERE pvr.target_id = $1 AND pvr.status = 'approved'
        ORDER BY pvr.created_at DESC
        """,
        current_user.id
    )

    base_url = BASE_URL
    
    result = []
    for req in requests:
        # Получить фотографии для этого запроса
        photo_ids = req["selected_photo_ids"] or []
        photos = []
        if photo_ids:
            photo_records = await conn.fetch(
                """
                SELECT id, file_id, created_at
                FROM art_objects
                WHERE id = ANY($1) AND owner_id = $2
                ORDER BY created_at DESC
                """,
                photo_ids,
                current_user.id
            )
            photos = [
                {
                    "id": photo["id"],
                    "url": f"{base_url}/uploads/{photo['file_id']}",
                    "file_id": photo["file_id"],
                    "created_at": photo["created_at"]
                }
                for photo in photo_records
            ]
        
        result.append({
            "request_id": str(req["id"]),
            "requester": {
                "id": req["requester_id"],
                "first_name": req["first_name"],
                "last_name": req["last_name"],
                "username": req["username"],
                "photo_url": req["photo_url"]
            },
            "selected_photo_ids": photo_ids,
            "photos": photos,
            "created_at": req["created_at"],
            "expires_at": req["expires_at"]
        })
    
    return result

@router.put("/{request_id}/update-photos")
async def update_permission_photos(
    request_id: UUID,
    photo_ids: List[int] = Body(..., embed=True),
    current_user: User = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_connection),
):
    """Update selected photos for an approved permission."""
    async with conn.transaction():
        # Логирование для отладки
        logger.info(f"Updating permission {request_id} for user {current_user.id}")
        
        # Сначала проверим, существует ли запрос вообще
        request_check = await conn.fetchrow(
            """
            SELECT id, target_id, requester_id, status
            FROM profile_view_requests
            WHERE id = $1
            """,
            request_id
        )
        
        if not request_check:
            logger.warning(f"Request {request_id} not found")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Permission not found."
            )
        
        logger.info(f"Request found: target_id={request_check['target_id']}, current_user.id={current_user.id}, status={request_check['status']}")
        
        # Теперь проверим права доступа и статус
        request = await conn.fetchrow(
            """
            SELECT * FROM profile_view_requests
            WHERE id = $1 AND target_id = $2 AND status = 'approved'
            FOR UPDATE
            """,
            request_id,
            current_user.id
        )

        if not request:
            # Более детальная диагностика
            if request_check['target_id'] != current_user.id:
                logger.warning(f"User {current_user.id} tried to update permission {request_id} but target_id is {request_check['target_id']}")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You are not authorized to update this permission."
                )
            elif request_check['status'] != 'approved':
                logger.warning(f"Permission {request_id} is not approved, status is {request_check['status']}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Permission is not approved. Current status: {request_check['status']}"
                )
            else:
                logger.warning(f"Request {request_id} not found for unknown reason")
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Permission not found or you are not authorized to update it."
                )

        if not photo_ids or len(photo_ids) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You must select at least one photo."
            )

        # Проверить, что все выбранные фото принадлежат пользователю
        photos = await conn.fetch(
            "SELECT id FROM art_objects WHERE id = ANY($1) AND owner_id = $2",
            photo_ids,
            current_user.id
        )

        if len(photos) != len(photo_ids):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not own all of the specified photos."
            )

        # Получить старый список фото перед обновлением
        old_photo_ids = request["selected_photo_ids"] or []
        
        # Найти фото, которые были удалены из разрешения
        removed_photo_ids = [pid for pid in old_photo_ids if pid not in photo_ids]
        
        # Удалить импортированные фото для фото, которые были убраны из разрешения
        if removed_photo_ids:
            result = await conn.execute(
                """
                DELETE FROM imported_photos
                WHERE user_id = $1 AND photo_id = ANY($2::int[])
                """,
                request["requester_id"],
                removed_photo_ids
            )
            deleted_count = int(result.split()[-1]) if result and 'DELETE' in result else 0
            logger.info(f"Deleted {deleted_count} imported photos for user {request['requester_id']} after permission update (removed photo IDs: {removed_photo_ids})")
        
        # Получить имя пользователя для уведомления
        user_info = await conn.fetchrow(
            "SELECT first_name, last_name FROM users WHERE id = $1",
            current_user.id
        )
        target_user_name = None
        if user_info:
            first_name = user_info["first_name"] or ""
            last_name = user_info["last_name"] or ""
            target_user_name = f"{first_name} {last_name}".strip() or None
        
        # Обновить выбранные фото
        await conn.execute(
            """
            UPDATE profile_view_requests
            SET selected_photo_ids = $1
            WHERE id = $2
            """,
            photo_ids,
            request_id
        )

        # Уведомить запрашивающего пользователя об обновлении
        await notify_profile_response(
            current_user.id,
            request["requester_id"],
            True,
            photo_ids,
            str(request_id),
            is_update=True,
            old_photo_ids=old_photo_ids,
            target_user_name=target_user_name
        )
        
        # Если были удалены фото, уведомить об обновлении материалов
        if removed_photo_ids:
            await notify_materials_updated(request["requester_id"])

        logger.info(f"Permission {request_id} updated by user {current_user.id}")

        return {
            "message": "Permission photos updated successfully.",
            "photo_count": len(photo_ids)
        }

@router.delete("/{request_id}/revoke")
async def revoke_permission(
    request_id: UUID,
    current_user: User = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_connection),
):
    """Revoke an approved permission."""
    async with conn.transaction():
        request = await conn.fetchrow(
            """
            SELECT * FROM profile_view_requests
            WHERE id = $1 AND target_id = $2 AND status = 'approved'
            FOR UPDATE
            """,
            request_id,
            current_user.id
        )

        if not request:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Permission not found or you are not authorized to revoke it."
            )

        # Получить имя пользователя для уведомления
        user_info = await conn.fetchrow(
            "SELECT first_name, last_name FROM users WHERE id = $1",
            current_user.id
        )
        target_user_name = None
        if user_info:
            first_name = user_info["first_name"] or ""
            last_name = user_info["last_name"] or ""
            target_user_name = f"{first_name} {last_name}".strip() or None

        # Отозвать разрешение (установить статус rejected)
        await conn.execute(
            """
            UPDATE profile_view_requests
            SET status = 'rejected'
            WHERE id = $1
            """,
            request_id
        )
        
        # Удалить импортированные фото запрашивающего пользователя от текущего пользователя
        # Это удалит все фото, которые requester импортировал от current_user (владельца)
        result = await conn.execute(
            """
            DELETE FROM imported_photos
            WHERE user_id = $1 AND photo_id IN (
                SELECT id FROM art_objects WHERE owner_id = $2
            )
            """,
            request["requester_id"],
            current_user.id
        )
        # Извлечь количество удаленных записей из результата
        deleted_count = int(result.split()[-1]) if result and 'DELETE' in result else 0
        logger.info(f"Deleted {deleted_count} imported photos for user {request['requester_id']} from owner {current_user.id}")

        # Уведомить запрашивающего пользователя об отзыве
        await notify_profile_response(
            current_user.id,
            request["requester_id"],
            False,
            [],
            str(request_id),
            target_user_name=target_user_name
        )
        
        # Уведомить запрашивающего об обновлении материалов (чтобы коллекция обновилась)
        await notify_materials_updated(request["requester_id"])

        logger.info(f"Permission {request_id} revoked by user {current_user.id}")

        return {
            "message": "Permission revoked successfully."
        }
