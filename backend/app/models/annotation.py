from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.core.database import Base
from app.core.crypto import EncryptedString

class Annotation(Base):
    __tablename__ = "annotations"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    label = Column(EncryptedString, nullable=False)
    confidence = Column(Float, default=1.0, nullable=False) # 1.0 for manual, < 1.0 for AI-assisted
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    version = Column(Integer, default=1, nullable=False)
    corrected_label = Column(EncryptedString, nullable=True) # stores previous label if corrected by human
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    task = relationship("Task", back_populates="annotations")
    created_by = relationship("User", back_populates="annotations_created")
    qa_results = relationship("QAResult", back_populates="annotation", cascade="all, delete-orphan")
