from sqlalchemy.orm import Session
from app.repositories.base import BaseRepository
from app.models.user import User
from app.schemas.auth import UserCreate
from app.core.security import get_password_hash

class UserRepository(BaseRepository):
    def get_by_id(self, user_id: int) -> User:
        return self.db.query(User).filter(User.id == user_id).first()

    def get_by_username(self, username: str) -> User:
        return self.db.query(User).filter(User.username == username).first()

    def create(self, user_in: UserCreate) -> User:
        db_user = User(
            username=user_in.username,
            hashed_password=get_password_hash(user_in.password),
            role=user_in.role or "annotator"
        )
        self.db.add(db_user)
        self.db.commit()
        self.db.refresh(db_user)
        return db_user

    def list_users(self) -> list[User]:
        return self.db.query(User).order_by(User.id).all()
