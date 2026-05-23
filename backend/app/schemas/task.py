from pydantic import BaseModel
from typing import Optional, List
from app.schemas.auth import UserOut
from app.schemas.annotation import AnnotationOut

class TaskCreate(BaseModel):
    type: str  # text, image
    data: str  # text snippet or image url
    priority: Optional[str] = "medium"  # low, medium, high
    assigned_to_id: Optional[int] = None
    status: Optional[str] = "pending"
    assignee_email: Optional[str] = None
    import_source: Optional[str] = "single"
    redact_pii: Optional[bool] = False
    lineage_history: Optional[str] = None


class TaskUpdate(BaseModel):
    status: Optional[str] = None  # pending, in-progress, completed, rejected
    assigned_to_id: Optional[int] = None
    priority: Optional[str] = None
    assignee_email: Optional[str] = None
    import_source: Optional[str] = None

class TaskOut(BaseModel):
    id: int
    type: str
    data: str
    status: str
    priority: str
    assigned_to_id: Optional[int] = None
    cost: float
    import_source: str
    lineage_history: Optional[str] = None
    assigned_to: Optional[UserOut] = None
    annotations: List[AnnotationOut] = []

    class Config:
        from_attributes = True

