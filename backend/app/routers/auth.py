from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import timedelta
from app.core.database import get_db
from app.core.security import verify_password, create_access_token
from app.repositories.user import UserRepository
from app.schemas.auth import UserCreate, UserOut, Token, LoginRequest
from app.services.auth import AuthService
from app.services.audit import AuditService

from typing import List, Optional
from pydantic import BaseModel

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.get("/users", response_model=List[UserOut])
def list_users(db: Session = Depends(get_db), current_user=Depends(AuthService.get_current_user)):
    user_repo = UserRepository(db)
    return user_repo.list_users()

@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    user_repo = UserRepository(db)
    existing_user = user_repo.get_by_username(user_in.username)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
        
    # Check if username is an email and extract domain suffix
    username_lower = user_in.username.lower()
    role = user_in.role or "annotator"
    
    if "@" in username_lower:
        if username_lower.endswith("@hginfotech.io") or username_lower.endswith("@hginfotech.com"):
            # Approved domain
            pass
        elif username_lower.endswith("@client.com"):
            # Approved domain
            pass
        else:
            # Unrecognized domain -> force to pending
            role = "pending"
    else:
        # Non-email username format -> force to pending for safety
        role = "pending"
        
    user_in.role = role
    user = user_repo.create(user_in)
    
    # Copy username to email if it is an email
    if "@" in user.username:
        user.email = user.username
        db.commit()
        db.refresh(user)

    AuditService.log_action(
        user_id=user.id,
        username=user.username,
        action="USER_REGISTER",
        resource_type="user",
        resource_id=user.id,
        details={"role": user.role}
    )
    return user

class MFALoginRequest(BaseModel):
    mfa_token: str
    code: str

@router.post("/token")
def login(login_req: LoginRequest, db: Session = Depends(get_db)):
    user_repo = UserRepository(db)
    user = user_repo.get_by_username(login_req.username)
    if not user or not verify_password(login_req.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect username or password"
        )
    
    # If user has MFA enabled, return status indicating MFA challenge is required
    if user.mfa_enabled:
        mfa_token = create_access_token(
            subject=user.username,
            expires_delta=timedelta(minutes=5)
        )
        return {
            "status": "mfa_required",
            "mfa_token": mfa_token,
            "user": {
                "id": user.id,
                "username": user.username,
                "role": user.role
            }
        }
        
    access_token = create_access_token(subject=user.username)
    user_out = UserOut(
        id=user.id,
        username=user.username,
        role=user.role,
        email=user.email,
        mfa_enabled=user.mfa_enabled,
        gdpr_consent=user.gdpr_consent
    )
    
    AuditService.log_action(
        user_id=user.id,
        username=user.username,
        action="USER_LOGIN",
        resource_type="user",
        resource_id=user.id,
        details={"role": user.role}
    )
    
    return {"access_token": access_token, "token_type": "bearer", "user": user_out}

@router.post("/login/mfa")
def login_mfa(req: MFALoginRequest, db: Session = Depends(get_db)):
    from jose import jwt, JWTError
    from app.core.config import settings
    
    try:
        payload = jwt.decode(req.mfa_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid MFA token"
            )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired MFA token"
        )
        
    user_repo = UserRepository(db)
    user = user_repo.get_by_username(username)
    if not user or not user.mfa_enabled or not user.mfa_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA is not enabled for this user"
        )
        
    from app.routers.mfa import verify_totp
    if verify_totp(user.mfa_secret, req.code):
        access_token = create_access_token(subject=user.username)
        user_out = UserOut(
            id=user.id,
            username=user.username,
            role=user.role,
            email=user.email,
            mfa_enabled=user.mfa_enabled,
            gdpr_consent=user.gdpr_consent
        )
        
        AuditService.log_action(
            user_id=user.id,
            username=user.username,
            action="USER_LOGIN_MFA",
            resource_type="user",
            resource_id=user.id,
            details={"role": user.role}
        )
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": user_out
        }
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code. Please try again."
        )

@router.get("/me", response_model=UserOut)
def read_users_me(current_user=Depends(AuthService.get_current_user)):
    return current_user


class SSOLoginRequest(BaseModel):
    provider: str
    email: str
    username: str
    role: Optional[str] = "annotator"

@router.post("/sso/callback")
def sso_callback(req: SSOLoginRequest, db: Session = Depends(get_db)):
    from app.models.user import User
    from app.core.security import get_password_hash
    import uuid
    
    # Check if user exists by username or email
    user = db.query(User).filter((User.username == req.username) | (User.email == req.email)).first()
    
    is_new = False
    if not user:
        is_new = True
        
        # Check email domain suffix to determine auto-provisioned role or place in pending queue
        email_lower = req.email.lower() if req.email else ""
        if email_lower.endswith("@hginfotech.io") or email_lower.endswith("@hginfotech.com"):
            role = "annotator"
        elif email_lower.endswith("@client.com"):
            role = "reviewer"
        else:
            role = "pending"
            
        user = User(
            username=req.username,
            hashed_password=get_password_hash(str(uuid.uuid4())),
            email=req.email,
            role=role,
            gdpr_consent=True
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        
        AuditService.log_action(
            user_id=user.id,
            username=user.username,
            action="USER_REGISTER_SSO",
            resource_type="user",
            resource_id=user.id,
            details={"provider": req.provider, "role": user.role}
        )
        
    access_token = create_access_token(subject=user.username)
    user_out = UserOut(
        id=user.id,
        username=user.username,
        role=user.role,
        email=user.email,
        mfa_enabled=user.mfa_enabled,
        gdpr_consent=user.gdpr_consent
    )
    
    AuditService.log_action(
        user_id=user.id,
        username=user.username,
        action="USER_LOGIN_SSO",
        resource_type="user",
        resource_id=user.id,
        details={"provider": req.provider, "role": user.role, "is_new": is_new}
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_out
    }

class ApproveUserRequest(BaseModel):
    role: str

@router.put("/users/{user_id}/approve", response_model=UserOut)
def approve_user(
    user_id: int,
    req: ApproveUserRequest,
    db: Session = Depends(get_db),
    current_user=Depends(AuthService.get_current_user)
):
    # Verify current user is admin
    if current_user.role.lower() != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can approve users and assign roles."
        )
        
    role_lower = req.role.lower()
    if role_lower not in ["admin", "reviewer", "annotator", "pending"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role selected."
        )
        
    from app.models.user import User
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
        
    old_role = user.role
    user.role = role_lower
    db.commit()
    db.refresh(user)
    
    AuditService.log_action(
        user_id=current_user.id,
        username=current_user.username,
        action="USER_APPROVE",
        resource_type="user",
        resource_id=user.id,
        details={"approved_user_id": user.id, "old_role": old_role, "new_role": user.role}
    )
    
    return user
