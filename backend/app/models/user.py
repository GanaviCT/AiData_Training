from sqlalchemy import Column, Integer, String, Boolean
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.core.crypto import EncryptedString

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="annotator", nullable=False) # admin, annotator, reviewer
    email = Column(EncryptedString, nullable=True)
    mfa_enabled = Column(Boolean, default=False, nullable=True)
    mfa_secret = Column(String, nullable=True)
    gdpr_consent = Column(Boolean, default=False, nullable=True)
    gdpr_consent_date = Column(String, nullable=True)

    # Relationships
    tasks_assigned = relationship("Task", back_populates="assigned_to")
    annotations_created = relationship("Annotation", back_populates="created_by")
    qa_reviews = relationship("QAResult", back_populates="reviewer")
