from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str = Field(min_length=1, max_length=255)
    phone: Optional[str] = Field(default=None, max_length=20)
    role: Literal["resident", "driver"]
    camp_id: Optional[str] = Field(default=None, max_length=100)
    zone: Optional[str] = Field(default=None, max_length=100)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class UserPublic(BaseModel):
    id: str
    email: Optional[str]
    full_name: str
    role: str
    kyc_status: str

    model_config = {"from_attributes": True}


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    expires_in: int


class AuthRegisterResponse(BaseModel):
    user: UserPublic
    tokens: TokenPair


class RefreshResponse(BaseModel):
    access_token: str
    refresh_token: str
    expires_in: int


class UserProfile(BaseModel):
    id: str
    email: Optional[str]
    full_name: str
    phone: Optional[str]
    role: str
    kyc_status: str
    camp_id: Optional[str]
    zone: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}
