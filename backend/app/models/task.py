from sqlalchemy import Column, Integer, String, Float, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.core.crypto import EncryptedText

class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(String, nullable=False)  # text, image
    data = Column(EncryptedText, nullable=False)    # text payload or image url
    status = Column(String, default="pending", nullable=False) # pending, in-progress, completed, rejected
    priority = Column(String, default="medium", nullable=False) # low, medium, high
    assigned_to_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    cost = Column(Float, default=0.0, nullable=False) # PPU simulated complexity cost
    import_source = Column(String, default="single", nullable=False) # single, bulk
    lineage_history = Column(String, nullable=True)

    # Relationships
    assigned_to = relationship("User", back_populates="tasks_assigned")
    annotations = relationship("Annotation", back_populates="task", cascade="all, delete-orphan")
