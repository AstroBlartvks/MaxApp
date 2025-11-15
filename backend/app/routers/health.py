from fastapi import APIRouter, Depends, HTTPException
from postgresql.database import get_connection
import asyncpg

router = APIRouter()

@router.get("/health", summary="Проверка работоспособности", tags=["Система"], response_model=dict)
async def health_check(conn: asyncpg.Connection = Depends(get_connection)):
    """
    Выполняет проверку работоспособности приложения и его зависимостей.
    Проверяет подключение к базе данных.
    """
    try:
        # Attempt to fetch a simple value from the database to confirm connectivity
        await conn.fetchval("SELECT 1")
        return {"status": "ok", "database": "connected"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database connection failed: {e}")
