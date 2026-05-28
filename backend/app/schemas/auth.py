from pydantic import BaseModel
from typing import Optional

class UserCreate(BaseModel):
    username: str
    password: str
    role: Optional[str] = "annotator"  # admin, annotator, reviewer

class UserOut(BaseModel):
    id: int
    username: str
    role: str
    email: Optional[str] = None
    mfa_enabled: Optional[bool] = False
    gdpr_consent: Optional[bool] = False
    permissions: Optional[list[str]] = []

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserOut

class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None

class LoginRequest(BaseModel):
    username: str
    password: str
