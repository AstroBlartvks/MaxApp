import json
from urllib.parse import parse_qsl
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Body
from postgresql.database import get_connection, upsert_user, store_refresh_token, get_refresh_token
from app.security import (
    validate_init_data, create_access_token, create_refresh_token,
    verify_token, REFRESH_SECRET_KEY, SECRET_KEY, get_current_user
)
from app.schemas import Token, UserData
import asyncpg

router = APIRouter(prefix="/auth", tags=["Аутентификация"])

@router.post("/login", response_model=Token)
async def login_for_access_token(
    init_data: str = Body(..., embed=True, description="Строка InitData, полученная от мессенджера."),
    conn: asyncpg.Connection = Depends(get_connection)
):
    """
    Аутентификация пользователя на основе InitData и возврат JWT.

    - Проверяет хеш InitData для подтверждения подлинности.
    - Создает или обновляет пользователя в базе данных.
    - Возвращает access и refresh токены.
    """
    if not validate_init_data(init_data):
        raise HTTPException(status_code=401, detail="Invalid or tampered InitData")

    try:
        data_dict = dict(parse_qsl(init_data))
        user_json = data_dict.get("user")
        if not user_json:
            raise HTTPException(status_code=400, detail="User data not found in InitData")
        user_data = UserData.parse_raw(user_json)
    except (json.JSONDecodeError, KeyError) as e:
        raise HTTPException(status_code=400, detail=f"Could not parse user data: {e}")

    user_record = await upsert_user(conn, user_data)
    if not user_record:
        raise HTTPException(status_code=500, detail="Could not create or update user")

    # Determine if the user is new by comparing timestamps
    # A small delta accounts for the transaction time.
    is_new_user = (user_record["last_seen_at"] - user_record["created_at"]).total_seconds() < 2

    user_id = user_record["id"]
    token_data = {"sub": str(user_id)}

    access_token = create_access_token(data=token_data)
    refresh_token, refresh_token_expires_at = create_refresh_token(data=token_data)

    await store_refresh_token(conn, user_id, refresh_token, refresh_token_expires_at)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "is_new_user": is_new_user,
    }

@router.post("/refresh", response_model=Token)
async def refresh_access_token(
    refresh_token: str = Body(..., embed=True, description="Refresh токен для получения новой пары токенов."),
    conn: asyncpg.Connection = Depends(get_connection)
):
    """
    Обновляет access токен с помощью refresh токена.
    """
    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    token_data = verify_token(refresh_token, REFRESH_SECRET_KEY, credentials_exception)
    
    db_token = await get_refresh_token(conn, refresh_token)
    if not db_token or db_token["is_revoked"] or db_token["expires_at"] < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Refresh token is invalid or has expired")

    # In a more advanced implementation, you might want to revoke the old
    # refresh token and issue a new one (token rotation).
    # For now, we'll just issue a new access token.

    new_access_token = create_access_token(data={"sub": str(token_data.user_id)})
    
    return {
        "access_token": new_access_token,
        "refresh_token": refresh_token, # Or issue a new one
        "token_type": "bearer",
        "is_new_user": False,
    }

@router.post("/toggle-public-profile")
async def toggle_public_profile(
    is_public: bool = Body(..., embed=True),
    current_user = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_connection)
):
    """
    Toggle public profile setting for the current user.
    When enabled, all photos become public. When disabled, all photos become private.
    """
    async with conn.transaction():
        # Update user's public profile setting
        await conn.execute(
            "UPDATE users SET is_public_profile = $1 WHERE id = $2",
            is_public,
            current_user.id
        )
        
        # Update all user's photos to match the profile setting
        await conn.execute(
            "UPDATE art_objects SET is_public = $1 WHERE owner_id = $2",
            is_public,
            current_user.id
        )
        
        # If making profile private, remove all imported copies from other users
        if not is_public:
            deleted_imports = await conn.fetch(
                """
                DELETE FROM imported_photos
                WHERE photo_id IN (
                    SELECT id FROM art_objects WHERE owner_id = $1
                )
                AND user_id != $1
                RETURNING user_id
                """,
                current_user.id
            )
            
            # Notify affected users
            from app.routers.photos import notify_materials_updated
            notified_users = set()
            for user_record in deleted_imports:
                user_id = user_record["user_id"]
                if user_id not in notified_users:
                    notified_users.add(user_id)
                    try:
                        await notify_materials_updated(user_id)
                    except Exception as e:
                        print(f"Failed to notify user {user_id}: {e}")
        
        return {
            "success": True,
            "is_public_profile": is_public,
            "message": "Профиль теперь публичный" if is_public else "Профиль теперь приватный"
        }

@router.get("/profile-settings")
async def get_profile_settings(
    current_user = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_connection)
):
    """
    Get current user's profile settings.
    """
    user = await conn.fetchrow(
        "SELECT is_public_profile, contact_link FROM users WHERE id = $1",
        current_user.id
    )
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "is_public_profile": user["is_public_profile"],
        "contact_link": user.get("contact_link")
    }

@router.post("/update-contact-link")
async def update_contact_link(
    contact_link: str = Body(..., embed=True),
    current_user = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_connection)
):
    """
    Update user's contact link (shown in public profile).
    """
    # Validate link length (max 200 chars)
    if contact_link and len(contact_link) > 200:
        raise HTTPException(
            status_code=400,
            detail="Contact link is too long (max 200 characters)"
        )
    
    # Allow empty string to clear the link
    link_to_save = contact_link if contact_link else None
    
    await conn.execute(
        "UPDATE users SET contact_link = $1 WHERE id = $2",
        link_to_save,
        current_user.id
    )
    
    return {
        "success": True,
        "contact_link": link_to_save
    }
