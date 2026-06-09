from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str = Field(min_length=1, max_length=255)
    phone: str | None = Field(default=None, max_length=20)
    role: Literal["resident", "driver"]
    camp_id: str | None = Field(default=None, max_length=100)
    zone: str | None = Field(default=None, max_length=100)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class UserPublic(BaseModel):
    id: str
    email: str | None
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
    email: str | None
    full_name: str
    phone: str | None
    role: str
    kyc_status: str
    camp_id: str | None
    zone: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
