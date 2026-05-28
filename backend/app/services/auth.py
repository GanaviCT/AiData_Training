from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_db
from app.repositories.user import UserRepository
from app.models.user import User
from app.schemas.auth import TokenData

security_scheme = HTTPBearer()

class AuthService:
    @staticmethod
    async def get_current_user(
        credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
        db: Session = Depends(get_db)
    ) -> User:
        token = credentials.credentials
        credentials_exception = HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            username: str = payload.get("sub")
            if username is None:
                raise credentials_exception
            token_data = TokenData(username=username)
        except JWTError:
            raise credentials_exception

        user_repo = UserRepository(db)
        user = user_repo.get_by_username(token_data.username)
        if user is None:
            raise credentials_exception
        return user

ROLE_PERMISSIONS = {
    "admin": [
        "tasks:create", "tasks:import", "tasks:assign", "tasks:view",
        "annotations:create", "annotations:view",
        "qa:submit", "qa:sample",
        "system:view", "system:backup", "system:debug"
    ],
    "reviewer": [
        "tasks:view", "annotations:view",
        "qa:submit",
        "system:view"
    ],
    "annotator": [
        "tasks:view", "annotations:create", "annotations:view"
    ]
}

class RoleChecker:
    def __init__(self, allowed_roles: list[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, current_user: User = Depends(AuthService.get_current_user)) -> User:
        if current_user.role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this resource"
            )
        return current_user

class PermissionChecker:
    def __init__(self, required_permission: str):
        self.required_permission = required_permission

    def __call__(self, current_user: User = Depends(AuthService.get_current_user)) -> User:
        user_role = current_user.role.lower() if current_user.role else "annotator"
        permissions = ROLE_PERMISSIONS.get(user_role, [])
        if self.required_permission not in permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"You do not have permission to access this resource. Required permission: {self.required_permission}"
            )
        return current_user

