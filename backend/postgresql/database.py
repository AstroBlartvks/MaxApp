import asyncpg
import os
from typing import Optional, List
from app.schemas import UserData
from datetime import datetime
from dotenv import load_dotenv

# Загружаем переменные окружения из .env файла
load_dotenv()

# Получаем DATABASE_URL из переменных окружения
# Если DATABASE_URL не задан, пытаемся собрать из отдельных параметров
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    # Собираем из отдельных параметров
    db_user = os.getenv("DB_USER", "app_user")
    db_password = os.getenv("DB_PASSWORD")
    db_host = os.getenv("DB_HOST", "127.0.0.1")
    db_port = os.getenv("DB_PORT", "5432")
    db_name = os.getenv("DB_NAME", "app_db")
    
    if not db_password:
        raise ValueError("Either DATABASE_URL or DB_PASSWORD environment variable is required. Please set it in .env file.")
    
    DATABASE_URL = f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"

_connection_pool: Optional[asyncpg.Pool] = None

async def connect_db():
    """Establishes a connection pool to the PostgreSQL database."""
    global _connection_pool
    if _connection_pool is None:
        _connection_pool = await asyncpg.create_pool(DATABASE_URL)
    print("Database connection pool created.")

async def close_db():
    """Closes the database connection pool."""
    global _connection_pool
    if _connection_pool:
        await _connection_pool.close()
        _connection_pool = None
    print("Database connection pool closed.")

async def get_connection():
    """Provides a connection from the pool."""
    if _connection_pool is None:
        raise RuntimeError("Database connection pool not initialized. Call connect_db() first.")
    async with _connection_pool.acquire() as connection:
        yield connection

async def upsert_user(conn: asyncpg.Connection, user_data: UserData) -> asyncpg.Record:
    """
    Creates a new user or updates an existing one based on the messenger ID.

    Args:
        conn: The database connection.
        user_data: A Pydantic model containing the user's information.

    Returns:
        The database record of the created or updated user.
    """
    query = """
        INSERT INTO users (id, first_name, last_name, username, language_code, photo_url, last_seen_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (id) DO UPDATE SET
            first_name = EXCLUDED.first_name,
            last_name = EXCLUDED.last_name,
            username = EXCLUDED.username,
            photo_url = EXCLUDED.photo_url,
            last_seen_at = NOW()
        RETURNING *;
    """
    return await conn.fetchrow(
        query,
        user_data.id,
        user_data.first_name,
        user_data.last_name,
        user_data.username,
        user_data.language_code,
        user_data.photo_url,
    )

from datetime import datetime

async def store_refresh_token(conn: asyncpg.Connection, user_id: int, token: str, expires_at: datetime):
    """Stores a refresh token in the database, revoking existing ones for the user."""
    await revoke_refresh_tokens_for_user(conn, user_id) # Revoke existing tokens
    
    # Check if token already exists and delete it if it does
    existing_token = await conn.fetchrow("SELECT id FROM refresh_tokens WHERE token = $1", token)
    if existing_token:
        await conn.execute("DELETE FROM refresh_tokens WHERE token = $1", token)
    
    query = """
        INSERT INTO refresh_tokens (user_id, token, expires_at)
        VALUES ($1, $2, $3)
    """
    await conn.execute(query, user_id, token, expires_at)

async def get_refresh_token(conn: asyncpg.Connection, token: str) -> Optional[asyncpg.Record]:
    """Retrieves a refresh token from the database."""
    query = "SELECT * FROM refresh_tokens WHERE token = $1"
    return await conn.fetchrow(query, token)

async def get_user_by_id(conn: asyncpg.Connection, user_id: int) -> Optional[asyncpg.Record]:
    """Retrieves a user from the database by their ID."""
    query = "SELECT * FROM users WHERE id = $1"
    return await conn.fetchrow(query, user_id)

async def create_art_object(conn: asyncpg.Connection, owner_id: int, file_name: str) -> asyncpg.Record:
    """Creates a new art object record in the database."""
    query = """
        INSERT INTO art_objects (owner_id, creator_id, file_id, is_original)
        VALUES ($1, $1, $2, TRUE)
        RETURNING *;
    """
    return await conn.fetchrow(query, owner_id, file_name)

async def get_photos_by_owner(conn: asyncpg.Connection, owner_id: int) -> List[asyncpg.Record]:
    """Retrieves all art objects for a specific owner."""
    query = "SELECT id, owner_id, creator_id, file_id, file_type, is_original, original_art_id, signature, created_at, description, tags, is_public FROM art_objects WHERE owner_id = $1 ORDER BY created_at DESC"
    return await conn.fetch(query, owner_id)

async def get_photos_by_ids(conn: asyncpg.Connection, photo_ids: List[int]) -> List[asyncpg.Record]:
    """Retrieves a list of art objects from the database by their IDs."""
    query = "SELECT * FROM art_objects WHERE id = ANY($1::int[])"
    return await conn.fetch(query, photo_ids)

async def delete_photos_by_ids(conn: asyncpg.Connection, photo_ids: List[int]) -> int:
    """Deletes art objects from the database by their IDs and returns the count of deleted rows."""
    if not photo_ids or len(photo_ids) == 0:
        return 0
    query = "DELETE FROM art_objects WHERE id = ANY($1::int[])"
    result = await conn.execute(query, photo_ids)
    # The result of execute is a string like 'DELETE 5' or 'DELETE 0'
    if result.startswith("DELETE"):
        deleted_count = int(result.split(" ")[1])
        return deleted_count
    return 0

async def create_pending_transfer(
    conn: asyncpg.Connection, photo_id: int, sharer_id: int, scanner_id: int
) -> asyncpg.Record:
    """Creates a new pending transfer record."""
    # Отменить все старые активные запросы на передачу в том же направлении (от sharer_id к scanner_id)
    # Это гарантирует, что может быть только один активный запрос на передачу от одного пользователя к другому
    # Но запросы в обратном направлении остаются активными
    await conn.execute(
        """
        UPDATE pending_transfers
        SET status = 'rejected'
        WHERE sharer_id = $1 AND scanner_id = $2
        AND status = 'pending'
        AND expires_at > NOW()
        """,
        sharer_id,
        scanner_id
    )
    
    # Создать новый запрос на передачу
    query = """
        INSERT INTO pending_transfers (photo_id, sharer_id, scanner_id)
        VALUES ($1, $2, $3)
        RETURNING *;
    """
    return await conn.fetchrow(query, photo_id, sharer_id, scanner_id)

async def get_pending_transfer(conn: asyncpg.Connection, transfer_id: str) -> Optional[asyncpg.Record]:
    """Retrieves a pending transfer by its ID."""
    query = "SELECT * FROM pending_transfers WHERE id = $1"
    return await conn.fetchrow(query, transfer_id)

async def update_pending_transfer_status(
    conn: asyncpg.Connection, transfer_id: str, status: str
) -> Optional[asyncpg.Record]:
    """Updates the status of a pending transfer."""
    query = """
        UPDATE pending_transfers SET status = $1, expires_at = NOW() + INTERVAL '5 minute'
        WHERE id = $2
        RETURNING *;
    """
    return await conn.fetchrow(query, status, transfer_id)

async def delete_pending_transfer(conn: asyncpg.Connection, transfer_id: str) -> bool:
    """Deletes a pending transfer record."""
    query = "DELETE FROM pending_transfers WHERE id = $1"
    result = await conn.execute(query, transfer_id)
    return result == "DELETE 1"

async def update_art_object_owner(conn: asyncpg.Connection, art_object_id: int, new_owner_id: int) -> Optional[asyncpg.Record]:
    """Updates the owner_id of an art_object."""
    query = """
        UPDATE art_objects SET owner_id = $1
        WHERE id = $2
        RETURNING *;
    """
    return await conn.fetchrow(query, new_owner_id, art_object_id)

async def revoke_refresh_tokens_for_user(conn: asyncpg.Connection, user_id: int):
    """Revokes all active refresh tokens for a given user."""
    query = """
        UPDATE refresh_tokens SET is_revoked = TRUE
        WHERE user_id = $1 AND is_revoked = FALSE;
    """
    await conn.execute(query, user_id)


# Example of how to use it (for testing purposes, not part of the main app logic)
async def test_connection():
    await connect_db()
    try:
        async for conn in get_connection():
            result = await conn.fetchval("SELECT 1")
            print(f"Test connection successful: {result}")
    except Exception as e:
        print(f"Test connection failed: {e}")
    finally:
        await close_db()

if __name__ == "__main__":
    import asyncio
    asyncio.run(test_connection())
