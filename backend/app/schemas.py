from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

# Schema for the data received from the messenger
class InitData(BaseModel):
    hash: str
    auth_date: int
    query_id: str
    chat: str
    user: str
    ip: str

# Schema for the user data embedded in InitData
class UserData(BaseModel):
    id: int
    first_name: str
    last_name: Optional[str] = None
    username: Optional[str] = None
    language_code: Optional[str] = None
    photo_url: Optional[str] = None

# Schema for a User as stored in the database
class User(BaseModel):
    id: int
    first_name: str
    last_name: Optional[str] = None
    username: Optional[str] = None
    language_code: Optional[str] = None
    photo_url: Optional[str] = None
    created_at: datetime
    last_seen_at: datetime

# Schema for the response containing the JWT token
class Token(BaseModel):
    access_token: str
    token_type: str
    refresh_token: str
    is_new_user: bool

# Schema for the data in the token
class TokenData(BaseModel):
    user_id: int

# Schema for initiating a transfer
class InitiateTransferRequest(BaseModel):
    photo_file_id: str
