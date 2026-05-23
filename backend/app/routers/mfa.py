from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.auth import AuthService
from app.models.user import User
from pydantic import BaseModel
import hmac
import hashlib
import time
import struct
import base64
import urllib.parse
from app.services.audit import AuditService

router = APIRouter(prefix="/auth/mfa", tags=["MFA"])

class MFAVerifyRequest(BaseModel):
    secret: str
    code: str

class MFADisableRequest(BaseModel):
    code: str

def get_hotp(secret: str, intervals_no: int) -> int:
    try:
        # pad secret if not multiple of 8
        missing_padding = len(secret) % 8
        if missing_padding:
            secret += '=' * (8 - missing_padding)
        secret_bytes = base64.b32decode(secret, casefold=True)
        msg = struct.pack(">Q", intervals_no)
        hmac_hash = hmac.new(secret_bytes, msg, hashlib.sha1).digest()
        o = hmac_hash[19] & 15
        token = (struct.unpack(">I", hmac_hash[o:o+4])[0] & 0x7fffffff) % 1000000
        return token
    except Exception:
        return -1

def verify_totp(secret: str, code: str) -> bool:
    try:
        code_int = int(code.strip())
        curr_interval = int(time.time()) // 30
        # Allow +/- 1 window (30 seconds before/after)
        for i in range(-1, 2):
            if get_hotp(secret, curr_interval + i) == code_int:
                return True
    except Exception:
        pass
    return False

def generate_mfa_secret() -> str:
    import os
    random_bytes = os.urandom(10)
    return base64.b32encode(random_bytes).decode('utf-8').replace('=', '')

@router.post("/setup")
def mfa_setup(
    current_user: User = Depends(AuthService.get_current_user)
):
    """
    Generates a new MFA TOTP secret and provisioning URI.
    Does NOT enable MFA for the user yet.
    """
    secret = generate_mfa_secret()
    label = f"TrainlyftAI:{current_user.username}"
    issuer = "TrainlyftAI"
    provisioning_uri = f"otpauth://totp/{urllib.parse.quote(label)}?secret={secret}&issuer={urllib.parse.quote(issuer)}"
    qr_code_url = f"https://api.qrserver.com/v1/create-qr-code/?size=200x200&data={urllib.parse.quote(provisioning_uri)}"
    
    return {
        "secret": secret,
        "provisioning_uri": provisioning_uri,
        "qr_code_url": qr_code_url
    }

@router.post("/enable")
def mfa_enable(
    req: MFAVerifyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(AuthService.get_current_user)
):
    """
    Verifies the TOTP code and enables MFA if correct.
    """
    if verify_totp(req.secret, req.code):
        current_user.mfa_secret = req.secret
        current_user.mfa_enabled = True
        db.commit()
        
        AuditService.log_action(
            user_id=current_user.id,
            username=current_user.username,
            action="MFA_ENABLE",
            resource_type="user",
            resource_id=current_user.id
        )
        return {"message": "MFA enabled successfully."}
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code. Please try again."
        )

@router.post("/disable")
def mfa_disable(
    req: MFADisableRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(AuthService.get_current_user)
):
    """
    Disables MFA for the user. Requires a valid OTP code.
    """
    if not current_user.mfa_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA is not enabled for this user."
        )
        
    if verify_totp(current_user.mfa_secret, req.code):
        current_user.mfa_secret = None
        current_user.mfa_enabled = False
        db.commit()
        
        AuditService.log_action(
            user_id=current_user.id,
            username=current_user.username,
            action="MFA_DISABLE",
            resource_type="user",
            resource_id=current_user.id
        )
        return {"message": "MFA disabled successfully."}
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code. Please try again."
        )
