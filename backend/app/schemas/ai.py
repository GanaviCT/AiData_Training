from pydantic import BaseModel
from typing import Optional, List

class AISuggestRequest(BaseModel):
    text: str
    categories: Optional[List[str]] = ["Positive", "Negative", "Neutral"]

class AISuggestResponse(BaseModel):
    label: str
    confidence: float
