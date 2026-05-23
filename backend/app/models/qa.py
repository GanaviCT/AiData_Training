from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.core.database import Base

class QAResult(Base):
    __tablename__ = "qa_results"

    id = Column(Integer, primary_key=True, index=True)
    annotation_id = Column(Integer, ForeignKey("annotations.id"), nullable=False)
    approved = Column(Boolean, nullable=False)
    reviewer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    comments = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    annotation = relationship("Annotation", back_populates="qa_results")
    reviewer = relationship("User", back_populates="qa_reviews")
