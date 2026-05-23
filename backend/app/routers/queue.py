from fastapi import APIRouter, Depends, status
from app.services.queue import BackgroundQueueService
from app.services.auth import RoleChecker
from app.models.user import User

router = APIRouter(prefix="/admin/queue", tags=["System Queue"])

@router.get("/status")
def get_queue_status(
    current_user: User = Depends(RoleChecker(["admin"]))
):
    """Fetch live background worker execution metrics, queue size and history"""
    return BackgroundQueueService.get_status()

@router.post("/clear")
def clear_queue_history(
    current_user: User = Depends(RoleChecker(["admin"]))
):
    """Reset background worker statistics and logs"""
    BackgroundQueueService.clear_history()
    return {"message": "Background task queue statistics cleared successfully"}
