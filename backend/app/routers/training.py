from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.training import TrainingService
from app.services.auth import AuthService
from app.models.user import User

router = APIRouter(tags=["Model Training"])

@router.post("/train-model")
def train_model(
    db: Session = Depends(get_db),
    current_user: User = Depends(AuthService.get_current_user)
):
    return TrainingService.train_model(db)

@router.get("/model/predict")
def predict(
    text: str = Query(..., description="Text content to classify"),
    current_user: User = Depends(AuthService.get_current_user)
):
    return TrainingService.predict(text)
