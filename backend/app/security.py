import hmac
import hashlib
import os
from datetime import datetime, timedelta
from typing import Optional
from urllib.parse import parse_qsl

from fastapi import Depends, HTTPException, status, WebSocket
from fastapi.security import HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel
from dotenv import load_dotenv

from postgresql.database import get_connection, get_user_by_id
from app.schemas import User
import asyncpg

# Загружаем переменные окружения из .env файла
load_dotenv()

# --- JWT Configuration ---
# Access Token: Short-lived token for accessing resources
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise ValueError("SECRET_KEY environment variable is required. Please set it in .env file.")

ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

# Refresh Token: Long-lived token for getting new access tokens
REFRESH_SECRET_KEY = os.getenv("REFRESH_SECRET_KEY")
if not REFRESH_SECRET_KEY:
    raise ValueError("REFRESH_SECRET_KEY environment variable is required. Please set it in .env file.")

REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "30"))

# --- Messenger Bot Configuration ---
# IMPORTANT: Replace this with your actual bot token from the messenger
BOT_TOKEN = os.getenv("BOT_TOKEN")
if not BOT_TOKEN:
    raise ValueError("BOT_TOKEN environment variable is required. Please set it in .env file.")

reusable_oauth2 = HTTPBearer(
    scheme_name='Bearer'
)

class TokenData(BaseModel):
    user_id: Optional[int] = None


async def get_current_user(
    conn: asyncpg.Connection = Depends(get_connection),
    token: str = Depends(reusable_oauth2)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: Optional[str] = payload.get("sub")
        if user_id is None or not user_id.isdigit():
            raise credentials_exception
        token_data = TokenData(user_id=int(user_id))
    except JWTError:
        raise credentials_exception

    user_record = await get_user_by_id(conn, token_data.user_id)
    if user_record is None:
        raise credentials_exception

    # Convert asyncpg.Record to User Pydantic model
    return User(**dict(user_record))


def create_access_token(data: dict) -> str:
    """Creates a new JWT access token."""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def create_refresh_token(data: dict) -> (str, datetime):
    """Creates a new JWT refresh token."""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, REFRESH_SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt, expire


def verify_token(token: str, secret_key: str, credentials_exception) -> TokenData:
    """Decodes and verifies a JWT, returning the token data."""
    try:
        payload = jwt.decode(token, secret_key, algorithms=[ALGORITHM])
        user_id_str: Optional[str] = payload.get("sub")
        if user_id_str is None or not user_id_str.isdigit():
            raise credentials_exception
        return TokenData(user_id=int(user_id_str))
    except JWTError:
        raise credentials_exception


def validate_init_data(init_data: str) -> bool:
    """
    Validates the integrity of the InitData string from the messenger.
    """
    if not BOT_TOKEN or BOT_TOKEN == "YOUR_BOT_TOKEN_HERE":
        print("Warning: BOT_TOKEN is not set. InitData validation will fail.")
        return False

    try:
        parsed_data = dict(parse_qsl(init_data))
    except ValueError:
        return False

    if "hash" not in parsed_data:
        return False

    received_hash = parsed_data.pop("hash")

    data_check_string = "\n".join(
        f"{k}={v}" for k, v in sorted(parsed_data.items())
    )

    secret_key = hmac.new(
        "WebAppData".encode(), BOT_TOKEN.encode(), hashlib.sha256
    ).digest()

    calculated_hash = hmac.new(
        secret_key, data_check_string.encode(), hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(calculated_hash, received_hash)

async def get_current_user_ws(websocket: WebSocket) -> int:
    """
    Authenticates WebSocket connection by extracting user_id from query parameters.
    In a real application, this would involve more robust token validation.
    """
    user_id = websocket.query_params.get("user_id")
    if not user_id or not user_id.isdigit():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated for WebSocket")
    return int(user_id)
