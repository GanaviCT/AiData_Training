from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.schemas.auth import UserOut

class QAReviewRequest(BaseModel):
    annotation_id: int
    approved: bool
    comments: Optional[str] = None

class QAResultOut(BaseModel):
    id: int
    annotation_id: int
    approved: bool
    reviewer_id: int
    comments: Optional[str] = None
    created_at: datetime
    reviewer: UserOut

    class Config:
        from_attributes = True

class QAStats(BaseModel):
    total_reviewed: int
    approved_count: int
    rejected_count: int
    accuracy_percentage: float
