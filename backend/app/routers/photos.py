import shutil
import uuid
import json
import os
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status, Body
from typing import List
import asyncpg
from dotenv import load_dotenv

from app.security import get_current_user
from app.schemas import User
from postgresql import database as db
from app.logging_config import app_logger

# Загружаем переменные окружения
load_dotenv()

router = APIRouter(
    prefix="/api/photos",
    tags=["Photos"],
    dependencies=[Depends(get_current_user)]
)

async def notify_materials_updated(user_id: int):
    from app.routers.websocket import manager
    message = json.dumps({
        "type": "materials_updated",
        "message": "Материалы обновлены"
    })
    await manager.send_personal_message(message, user_id)

UPLOADS_DIR = Path(os.getenv("UPLOADS_DIR", "uploads"))
BASE_URL = os.getenv("BASE_URL", "https://api.whitea.cloud")

# Функция для получения CORS origin из main.py
def get_cors_origin():
    try:
        from app.main import origins
        return origins[0] if origins else "https://whitea.cloud"
    except:
        return os.getenv("CORS_ORIGINS", "https://whitea.cloud").split(",")[0].strip()

@router.get("/", response_model=List[dict])
async def get_user_photos(
    current_user: User = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(db.get_connection)
):
    """
    Retrieves a list of all photos for the currently authenticated user,
    including both owned photos and imported (requested) photos.
    """
    # Get owned photos
    owned_photos = await db.get_photos_by_owner(conn, owner_id=current_user.id)
    
    # Get imported photos
    imported_photos_records = await conn.fetch(
        """
        SELECT ao.id, ao.file_id, ao.created_at, ao.owner_id, ao.description, ao.tags, ao.is_public, ip.imported_at
        FROM imported_photos ip
        JOIN art_objects ao ON ip.photo_id = ao.id
        WHERE ip.user_id = $1
        ORDER BY ip.imported_at DESC
        """,
        current_user.id
    )
    
    base_url = BASE_URL
    
    # Format owned photos
    result = [
        {
            "id": photo["id"],
            "url": f"{base_url}/uploads/{photo['file_id']}",
            "file_id": photo["file_id"],
            "created_at": photo["created_at"],
            "description": photo.get("description"),
            "tags": photo.get("tags") or [],
            "is_public": photo.get("is_public", False),
            "is_imported": False,
            "is_own": True
        }
        for photo in owned_photos
    ]
    
    # Add imported photos
    for photo in imported_photos_records:
        result.append({
            "id": photo["id"],
            "url": f"{base_url}/uploads/{photo['file_id']}",
            "file_id": photo["file_id"],
            "created_at": photo["created_at"],
            "description": photo.get("description"),
            "tags": photo.get("tags") or [],
            "is_public": photo.get("is_public", False),
            "imported_at": photo["imported_at"],
            "is_imported": True,
            "is_own": False,
            "owner_id": photo["owner_id"]
        })
    
    return result

@router.post("/upload", response_model=List[dict], status_code=status.HTTP_201_CREATED)
async def upload_photos(
    files: List[UploadFile] = File(...),
    current_user: User = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(db.get_connection)
):
    """
    Uploads one or more photo files.
    """
    created_photos = []
    for file in files:
        if not file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail=f"File '{file.filename}' is not an image.")

        # Generate a unique filename
        file_extension = Path(file.filename).suffix
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        file_path = UPLOADS_DIR / unique_filename

        # Save the file
        try:
            with file_path.open("wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
        finally:
            file.file.close()

        # Create database record
        art_object = await db.create_art_object(conn, owner_id=current_user.id, file_name=unique_filename)
        created_photos.append({
            "id": art_object["id"],
            "url": f"{BASE_URL}/uploads/{art_object['file_id']}",
            "file_id": art_object["file_id"],
            "created_at": art_object["created_at"]
        })

    await notify_materials_updated(current_user.id)
    return created_photos

@router.post("/check-usage")
async def check_photo_usage(
    photo_ids: List[int] = Body(..., embed=True),
    current_user: User = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(db.get_connection)
):
    """
    Checks if photos are used in active requests or permissions.
    """
    if not photo_ids:
        return {"used_photos": [], "unused_photos": []}
    
    used_photos = []
    unused_photos = []
    
    for photo_id in photo_ids:
        # Проверить, используется ли фото в активных запросах на просмотр профиля
        profile_requests = await conn.fetch(
            """
            SELECT id, status, target_id, requester_id
            FROM profile_view_requests
            WHERE $1 = ANY(selected_photo_ids)
            AND status IN ('pending', 'approved')
            AND expires_at > NOW()
            AND target_id = $2
            """,
            photo_id,
            current_user.id
        )
        
        # Проверить, используется ли фото в активных трейдах
        trades = await conn.fetch(
            """
            SELECT id, status, receiver_id
            FROM trades
            WHERE art_object_id = $1
            AND status IN ('pending', 'scanned')
            AND expires_at > NOW()
            AND sender_id = $2
            """,
            photo_id,
            current_user.id
        )
        
        # Проверить, используется ли фото в активных запросах на передачу
        transfers = await conn.fetch(
            """
            SELECT id, status, scanner_id
            FROM pending_transfers
            WHERE photo_id = $1
            AND status = 'pending'
            AND expires_at > NOW()
            AND sharer_id = $2
            """,
            photo_id,
            current_user.id
        )
        
        if profile_requests or trades or transfers:
            usage_info = {
                "photo_id": photo_id,
                "in_profile_requests": len(profile_requests) > 0,
                "in_trades": len(trades) > 0,
                "in_transfers": len(transfers) > 0,
                "profile_requests_count": len(profile_requests),
                "trades_count": len(trades),
                "transfers_count": len(transfers)
            }
            used_photos.append(usage_info)
        else:
            unused_photos.append(photo_id)
    
    return {
        "used_photos": used_photos,
        "unused_photos": unused_photos
    }

@router.delete("/", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_photos(
    photo_ids: List[int] = Body(..., embed=True),
    current_user: User = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(db.get_connection)
):
    """
    Deletes one or more photos owned by the current user.
    """
    async with conn.transaction():
        try:
            app_logger.info(f"Delete photos request from user {current_user.id}: {photo_ids}")
            
            if not photo_ids:
                app_logger.warning("Empty photo_ids list provided")
                from fastapi import Response
                return Response(
                    status_code=status.HTTP_204_NO_CONTENT,
                    headers={
                        "Access-Control-Allow-Origin": get_cors_origin(),
                        "Access-Control-Allow-Credentials": "true",
                        "Access-Control-Allow-Methods": "*",
                        "Access-Control-Allow-Headers": "*",
                    }
                )

            # Fetch the photos to verify ownership and get filenames
            photos_to_delete = await db.get_photos_by_ids(conn, photo_ids)
            app_logger.info(f"Found {len(photos_to_delete)} photos to delete")

            if not photos_to_delete or len(photos_to_delete) == 0:
                app_logger.warning(f"No photos found for IDs: {photo_ids}")
                raise HTTPException(status_code=404, detail="One or more photos not found.")

            if len(photos_to_delete) != len(photo_ids):
                app_logger.warning(f"Photo count mismatch: requested {len(photo_ids)}, found {len(photos_to_delete)}")
                raise HTTPException(status_code=404, detail="One or more photos not found.")

            # Verify ownership
            for photo in photos_to_delete:
                if photo["owner_id"] != current_user.id:
                    app_logger.warning(f"User {current_user.id} tried to delete photo {photo['id']} owned by {photo['owner_id']}")
                    raise HTTPException(status_code=403, detail="You do not have permission to delete one or more of these photos.")

            # Удалить связанные записи перед удалением фотографий (в правильном порядке из-за внешних ключей)
            # 1. Удалить записи из ownership_history (ссылается на art_objects)
            await conn.execute(
                """
                DELETE FROM ownership_history
                WHERE art_object_id = ANY($1::int[])
                """,
                photo_ids
            )
            app_logger.info(f"Deleted ownership history for photos: {photo_ids}")
            
            # 2. Удалить трейды, связанные с этими фотографиями
            await conn.execute(
                """
                DELETE FROM trades
                WHERE art_object_id = ANY($1::int[])
                """,
                photo_ids
            )
            app_logger.info(f"Deleted trades for photos: {photo_ids}")
            
            # 3. Удалить запросы на передачу, связанные с этими фотографиями
            await conn.execute(
                """
                DELETE FROM pending_transfers
                WHERE photo_id = ANY($1::int[])
                """,
                photo_ids
            )
            app_logger.info(f"Deleted pending transfers for photos: {photo_ids}")
            
            # 4. Получить список пользователей, у которых импортированы эти фото, и уведомить их
            users_with_imports = await conn.fetch(
                """
                SELECT DISTINCT user_id
                FROM imported_photos
                WHERE photo_id = ANY($1::int[])
                """,
                photo_ids
            )
            
            # 4a. Удалить импортированные ссылки на эти фото у других пользователей
            await conn.execute(
                """
                DELETE FROM imported_photos
                WHERE photo_id = ANY($1::int[])
                """,
                photo_ids
            )
            app_logger.info(f"Deleted imported photo references for photos: {photo_ids}")
            
            # 4b. Уведомить всех пользователей, у которых были импортированы эти фото
            for user_record in users_with_imports:
                user_id = user_record["user_id"]
                if user_id != current_user.id:  # Не уведомляем владельца
                    try:
                        await notify_materials_updated(user_id)
                        app_logger.info(f"Notified user {user_id} about deleted imported photos")
                    except Exception as e:
                        app_logger.warning(f"Failed to notify user {user_id}: {e}")
            
            # 5. Обновить запросы на просмотр профиля - удалить фото из selected_photo_ids
            # Сначала найдем все запросы, которые содержат эти фото
            requests_to_update = await conn.fetch(
                """
                SELECT id, selected_photo_ids
                FROM profile_view_requests
                WHERE selected_photo_ids && $1::int[]
                AND status IN ('pending', 'approved')
                """,
                photo_ids
            )
            
            for request in requests_to_update:
                old_ids = request["selected_photo_ids"] or []
                new_ids = [pid for pid in old_ids if pid not in photo_ids]
                await conn.execute(
                    """
                    UPDATE profile_view_requests
                    SET selected_photo_ids = $1
                    WHERE id = $2
                    """,
                    new_ids if new_ids else None,
                    request["id"]
                )
            app_logger.info(f"Updated profile view requests for photos: {photo_ids}")

            # Delete from database (последним, так как на него ссылаются другие таблицы)
            deleted_count = await db.delete_photos_by_ids(conn, photo_ids)
            app_logger.info(f"Deleted {deleted_count} photos from database")

            # Delete files from disk (после успешного удаления из БД)
            for photo in photos_to_delete:
                try:
                    file_path = UPLOADS_DIR / photo["file_id"]
                    if file_path.exists():
                        file_path.unlink(missing_ok=True)
                        app_logger.info(f"Deleted file: {photo['file_id']}")
                except Exception as e:
                    # Log this error but don't block DB deletion
                    app_logger.warning(f"Error deleting file {photo['file_id']}: {e}")

            await notify_materials_updated(current_user.id)
            
            from fastapi import Response
            return Response(
                status_code=status.HTTP_204_NO_CONTENT,
                headers={
                    "Access-Control-Allow-Origin": get_cors_origin(),
                    "Access-Control-Allow-Credentials": "true",
                    "Access-Control-Allow-Methods": "*",
                    "Access-Control-Allow-Headers": "*",
                }
            )
        except HTTPException:
            raise
        except Exception as e:
            app_logger.error(f"Error deleting photos: {e}", exc_info=e)
            raise HTTPException(status_code=500, detail=f"Failed to delete photos: {str(e)}")

@router.post("/import/{photo_id}", status_code=status.HTTP_201_CREATED)
async def import_photo(
    photo_id: int,
    current_user: User = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(db.get_connection)
):
    """
    Imports (requests) a specific photo from another user's profile.
    The photo must be public or from an approved profile view request.
    """
    async with conn.transaction():
        # Check if the photo exists
        photo = await conn.fetchrow(
            "SELECT id, owner_id, is_public FROM art_objects WHERE id = $1",
            photo_id
        )
        
        if not photo:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Photo not found."
            )
        
        # Prevent importing own photos
        if photo["owner_id"] == current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot import your own photos."
            )
        
        # Check if photo is public OR user has explicit permission
        is_public = photo.get("is_public", False)
        
        has_permission = False
        if is_public:
            has_permission = True
        else:
            # Check if user has permission via approved profile request
            has_permission = await conn.fetchval(
                """
                SELECT EXISTS(
                    SELECT 1 FROM profile_view_requests
                    WHERE requester_id = $1
                    AND target_id = $2
                    AND status = 'approved'
                    AND $3 = ANY(selected_photo_ids)
                    AND expires_at > NOW()
                )
                """,
                current_user.id,
                photo["owner_id"],
                photo_id
            )
        
        if not has_permission:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to import this photo. Please request access first."
            )
        
        # Check if already imported
        already_imported = await conn.fetchval(
            """
            SELECT EXISTS(
                SELECT 1 FROM imported_photos
                WHERE user_id = $1 AND photo_id = $2
            )
            """,
            current_user.id,
            photo_id
        )
        
        if already_imported:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Photo is already imported."
            )
        
        # Import the photo
        await conn.execute(
            """
            INSERT INTO imported_photos (user_id, photo_id)
            VALUES ($1, $2)
            """,
            current_user.id,
            photo_id
        )
        
        app_logger.info(f"User {current_user.id} imported photo {photo_id} from user {photo['owner_id']}")
        
        await notify_materials_updated(current_user.id)
        
        return {"message": "Photo imported successfully", "photo_id": photo_id}

@router.delete("/imported/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_imported_photo(
    photo_id: int,
    current_user: User = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(db.get_connection)
):
    """
    Removes an imported photo from the user's collection.
    This does not delete the original photo, only the reference.
    """
    async with conn.transaction():
        # Check if the photo is imported by this user
        imported = await conn.fetchrow(
            """
            SELECT id FROM imported_photos
            WHERE user_id = $1 AND photo_id = $2
            """,
            current_user.id,
            photo_id
        )
        
        if not imported:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Imported photo not found."
            )
        
        # Remove the import
        await conn.execute(
            """
            DELETE FROM imported_photos
            WHERE user_id = $1 AND photo_id = $2
            """,
            current_user.id,
            photo_id
        )
        
        app_logger.info(f"User {current_user.id} removed imported photo {photo_id}")
        
        await notify_materials_updated(current_user.id)
        
        from fastapi import Response
        return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.get("/imported/ids", response_model=List[int])
async def get_imported_photo_ids(
    current_user: User = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(db.get_connection)
):
    """
    Get list of photo IDs that the current user has imported.
    Returns just the IDs for quick checks.
    """
    photo_ids = await conn.fetch(
        """
        SELECT photo_id FROM imported_photos
        WHERE user_id = $1
        """,
        current_user.id
    )
    
    return [record["photo_id"] for record in photo_ids]

@router.post("/favorite/{photo_id}", status_code=status.HTTP_201_CREATED)
async def add_favorite(
    photo_id: int,
    current_user: User = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(db.get_connection)
):
    """
    Add a photo to user's favorites.
    Works for both owned and imported photos.
    """
    async with conn.transaction():
        # Check if photo exists and user has access to it
        photo = await conn.fetchrow(
            """
            SELECT id, owner_id FROM art_objects WHERE id = $1
            """,
            photo_id
        )
        
        if not photo:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Photo not found."
            )
        
        # Check if user has access to this photo (owned or imported)
        has_access = False
        if photo["owner_id"] == current_user.id:
            has_access = True
        else:
            # Check if imported
            is_imported = await conn.fetchval(
                """
                SELECT EXISTS(
                    SELECT 1 FROM imported_photos
                    WHERE user_id = $1 AND photo_id = $2
                )
                """,
                current_user.id,
                photo_id
            )
            has_access = is_imported
        
        if not has_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this photo."
            )
        
        # Check if already favorited
        already_favorited = await conn.fetchval(
            """
            SELECT EXISTS(
                SELECT 1 FROM favorite_photos
                WHERE user_id = $1 AND photo_id = $2
            )
            """,
            current_user.id,
            photo_id
        )
        
        if already_favorited:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Photo is already in favorites."
            )
        
        # Add to favorites
        await conn.execute(
            """
            INSERT INTO favorite_photos (user_id, photo_id)
            VALUES ($1, $2)
            """,
            current_user.id,
            photo_id
        )
        
        app_logger.info(f"User {current_user.id} added photo {photo_id} to favorites")
        
        return {"message": "Photo added to favorites", "photo_id": photo_id}

@router.delete("/favorite/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_favorite(
    photo_id: int,
    current_user: User = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(db.get_connection)
):
    """
    Remove a photo from user's favorites.
    """
    async with conn.transaction():
        # Check if the photo is favorited by this user
        favorited = await conn.fetchrow(
            """
            SELECT id FROM favorite_photos
            WHERE user_id = $1 AND photo_id = $2
            """,
            current_user.id,
            photo_id
        )
        
        if not favorited:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Photo is not in favorites."
            )
        
        # Remove from favorites
        await conn.execute(
            """
            DELETE FROM favorite_photos
            WHERE user_id = $1 AND photo_id = $2
            """,
            current_user.id,
            photo_id
        )
        
        app_logger.info(f"User {current_user.id} removed photo {photo_id} from favorites")
        
        from fastapi import Response
        return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.get("/favorites", response_model=List[dict])
async def get_favorites(
    current_user: User = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(db.get_connection)
):
    """
    Get all favorite photos for the current user.
    """
    favorites = await conn.fetch(
        """
        SELECT ao.id, ao.file_id, ao.created_at, ao.owner_id, fp.favorited_at,
               CASE WHEN ao.owner_id = $1 THEN false ELSE true END as is_imported
        FROM favorite_photos fp
        JOIN art_objects ao ON fp.photo_id = ao.id
        WHERE fp.user_id = $1
        ORDER BY fp.favorited_at DESC
        """,
        current_user.id
    )
    
    base_url = BASE_URL
    
    return [
        {
            "id": fav["id"],
            "url": f"{base_url}/uploads/{fav['file_id']}",
            "file_id": fav["file_id"],
            "created_at": fav["created_at"],
            "favorited_at": fav["favorited_at"],
            "is_imported": fav["is_imported"],
            "is_favorite": True,
            "owner_id": fav["owner_id"] if fav["is_imported"] else None
        }
        for fav in favorites
    ]

@router.get("/favorites/ids", response_model=List[int])
async def get_favorite_ids(
    current_user: User = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(db.get_connection)
):
    """
    Get list of photo IDs that are in user's favorites.
    Returns just the IDs for quick checks.
    """
    photo_ids = await conn.fetch(
        """
        SELECT photo_id FROM favorite_photos
        WHERE user_id = $1
        """,
        current_user.id
    )
    
    return [record["photo_id"] for record in photo_ids]

@router.post("/{photo_id}/metadata")
async def update_photo_metadata(
    photo_id: int,
    description: str = Body(None),
    tags: List[str] = Body(None),
    is_public: bool = Body(None),
    current_user: User = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(db.get_connection)
):
    """
    Update photo metadata (description, tags, and/or is_public).
    Only the owner can update metadata.
    """
    async with conn.transaction():
        # Check if photo exists and user owns it
        photo = await conn.fetchrow(
            "SELECT id, owner_id FROM art_objects WHERE id = $1",
            photo_id
        )
        
        if not photo:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Photo not found."
            )
        
        if photo["owner_id"] != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to edit this photo."
            )
        
        # Build update query dynamically
        updates = []
        params = [photo_id]
        param_count = 2
        
        if description is not None:
            updates.append(f"description = ${param_count}")
            params.append(description)
            param_count += 1
        
        if tags is not None:
            updates.append(f"tags = ${param_count}")
            params.append(tags)
            param_count += 1
        
        if is_public is not None:
            updates.append(f"is_public = ${param_count}")
            params.append(is_public)
            param_count += 1
        
        if not updates:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No metadata to update."
            )
        
        query = f"""
            UPDATE art_objects
            SET {', '.join(updates)}
            WHERE id = $1
            RETURNING id, description, tags, is_public
        """
        
        updated_photo = await conn.fetchrow(query, *params)
        
        # If making photo non-public, remove it from other users' imported collections
        if is_public is False:
            deleted_imports = await conn.fetch(
                """
                DELETE FROM imported_photos
                WHERE photo_id = $1 AND user_id != $2
                RETURNING user_id
                """,
                photo_id,
                current_user.id
            )
            
            # Notify affected users
            for user_record in deleted_imports:
                user_id = user_record["user_id"]
                try:
                    await notify_materials_updated(user_id)
                    app_logger.info(f"Notified user {user_id} about removed public photo {photo_id}")
                except Exception as e:
                    app_logger.warning(f"Failed to notify user {user_id}: {e}")
        
        app_logger.info(f"User {current_user.id} updated metadata for photo {photo_id}")
        
        return {
            "photo_id": updated_photo["id"],
            "description": updated_photo["description"],
            "tags": updated_photo["tags"] or [],
            "is_public": updated_photo["is_public"]
        }

@router.get("/public", response_model=List[dict])
async def get_public_photos(
    limit: int = 20,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(db.get_connection)
):
    """
    Get all public photos from all users.
    Returns photos where is_public = true OR owner has is_public_profile = true.
    Supports pagination.
    """
    # Get public photos: is_public = true OR owner has public profile
    public_photos = await conn.fetch(
        """
        SELECT 
            ao.id,
            ao.file_id,
            ao.created_at,
            ao.owner_id,
            ao.description,
            ao.tags,
            ao.is_public,
            u.first_name,
            u.last_name,
            u.username
        FROM art_objects ao
        JOIN users u ON ao.owner_id = u.id
        WHERE (ao.is_public = true OR u.is_public_profile = true)
        AND ao.owner_id != $1  -- Exclude current user's own photos
        ORDER BY ao.created_at DESC
        LIMIT $2 OFFSET $3
        """,
        current_user.id,
        limit,
        offset
    )
    
    # Get imported photo IDs for current user to mark which photos are already imported
    imported_photo_ids = await conn.fetch(
        """
        SELECT photo_id FROM imported_photos
        WHERE user_id = $1
        """,
        current_user.id
    )
    imported_ids_set = {row["photo_id"] for row in imported_photo_ids}
    
    base_url = BASE_URL
    
    result = []
    for photo in public_photos:
        result.append({
            "id": photo["id"],
            "url": f"{base_url}/uploads/{photo['file_id']}",
            "file_id": photo["file_id"],
            "created_at": photo["created_at"],
            "description": photo.get("description"),
            "tags": photo.get("tags") or [],
            "is_public": photo.get("is_public", False),
            "owner_id": photo["owner_id"],
            "owner_name": f"{photo.get('first_name', '')} {photo.get('last_name', '')}".strip() or photo.get("username") or f"User {photo['owner_id']}",
            "is_imported": photo["id"] in imported_ids_set
        })
    
    return result

@router.get("/{photo_id}/metadata")
async def get_photo_metadata(
    photo_id: int,
    current_user: User = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(db.get_connection)
):
    """
    Get photo metadata (description, tags, and is_public).
    User must own the photo or have it imported.
    """
    photo = await conn.fetchrow(
        """
        SELECT ao.id, ao.description, ao.tags, ao.is_public, ao.owner_id
        FROM art_objects ao
        WHERE ao.id = $1
        """,
        photo_id
    )
    
    if not photo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Photo not found."
        )
    
    # Check if user has access
    has_access = photo["owner_id"] == current_user.id
    is_owner = has_access
    
    if not has_access:
        # Check if imported
        is_imported = await conn.fetchval(
            """
            SELECT EXISTS(
                SELECT 1 FROM imported_photos
                WHERE user_id = $1 AND photo_id = $2
            )
            """,
            current_user.id,
            photo_id
        )
        has_access = is_imported
    
    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this photo."
        )
    
    return {
        "photo_id": photo["id"],
        "description": photo["description"],
        "tags": photo["tags"] or [],
        "is_public": photo["is_public"],
        "can_edit": is_owner,
        "can_edit_public": is_owner
    }