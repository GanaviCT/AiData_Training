from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.schemas.auth import UserOut
from app.schemas.qa import QAResultOut

class AnnotationCreate(BaseModel):
    task_id: int
    label: str
    confidence: Optional[float] = 1.0
    corrected_label: Optional[str] = None
    recipient_email: Optional[str] = None

class AnnotationOut(BaseModel):
    id: int
    task_id: int
    label: str
    confidence: float
    created_by_id: int
    version: int
    corrected_label: Optional[str] = None
    created_at: datetime
    created_by: UserOut
    qa_results: List[QAResultOut] = []

    class Config:
        from_attributes = True

