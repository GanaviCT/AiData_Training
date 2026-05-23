from fastapi import APIRouter, Depends
from app.services.ai import AIService
from app.services.auth import AuthService
from app.schemas.ai import AISuggestRequest, AISuggestResponse
from app.models.user import User

router = APIRouter(prefix="/ai", tags=["AI Assistance"])

@router.post("/suggest-label", response_model=AISuggestResponse)
def suggest_label(
    request_in: AISuggestRequest,
    ai_service: AIService = Depends(),
    current_user: User = Depends(AuthService.get_current_user)
):
    return ai_service.suggest_label(request_in)
