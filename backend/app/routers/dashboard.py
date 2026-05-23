from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.task import Task
from app.models.annotation import Annotation
from app.models.qa import QAResult
from app.services.auth import AuthService
from app.models.user import User
from app.services.cache import CacheService

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/stats")
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(AuthService.get_current_user)
):
    cache_key = "dashboard:stats"
    cached_val = CacheService.get(cache_key)
    if cached_val is not None:
        return cached_val

    total_tasks = db.query(func.count(Task.id)).scalar() or 0
    completed_tasks = db.query(func.count(Task.id)).filter(Task.status == "completed").scalar() or 0
    
    # Approved tasks are those that have an annotation with an approved QA review
    approved_tasks = (
        db.query(func.count(Task.id))
        .join(Annotation, Task.id == Annotation.task_id)
        .join(QAResult, Annotation.id == QAResult.annotation_id)
        .filter(QAResult.approved == True)
        .scalar()
    ) or 0

    accuracy = (approved_tasks / total_tasks * 100.0) if total_tasks > 0 else 0.0
    total_spent = db.query(func.sum(Task.cost)).scalar() or 0.0

    res = {
        "total_tasks": total_tasks,
        "completed_tasks": completed_tasks,
        "approved_tasks": approved_tasks,
        "accuracy": round(accuracy, 2),
        "total_spent": round(total_spent, 2)
    }
    CacheService.set(cache_key, res, expire_seconds=300)
    return res

@router.get("/recent-activity")
def get_recent_activity(
    db: Session = Depends(get_db),
    current_user: User = Depends(AuthService.get_current_user)
):
    cache_key = "dashboard:recent-activity"
    cached_val = CacheService.get(cache_key)
    if cached_val is not None:
        return cached_val

    # Fetch recent annotations/reviews as recent activity
    recent_annotations = (
        db.query(Annotation)
        .order_by(Annotation.created_at.desc())
        .limit(5)
        .all()
    )
    
    activities = []
    for ann in recent_annotations:
        activities.append({
            "id": f"ann-{ann.id}",
            "type": "annotation",
            "message": f"Task #{ann.task_id} annotated with label '{ann.label}' by {ann.created_by.username if ann.created_by else 'unknown'}",
            "timestamp": ann.created_at.isoformat() if ann.created_at else None
        })
        
    CacheService.set(cache_key, activities, expire_seconds=300)
    return activities

@router.get("/leaderboard")
def get_leaderboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(AuthService.get_current_user)
):
    cache_key = "dashboard:leaderboard"
    cached_val = CacheService.get(cache_key)
    if cached_val is not None:
        return cached_val

    # Find all annotators
    annotators = db.query(User).filter(User.role == "annotator").all()
    
    leaderboard = []
    for user in annotators:
        tasks_completed = db.query(func.count(Annotation.id)).filter(Annotation.created_by_id == user.id).scalar() or 0
        
        approved_count = (
            db.query(func.count(Annotation.id))
            .join(QAResult, Annotation.id == QAResult.annotation_id)
            .filter(Annotation.created_by_id == user.id, QAResult.approved == True)
            .scalar()
        ) or 0
        
        rejected_count = (
            db.query(func.count(Annotation.id))
            .join(QAResult, Annotation.id == QAResult.annotation_id)
            .filter(Annotation.created_by_id == user.id, QAResult.approved == False)
            .scalar()
        ) or 0
        
        total_qa = approved_count + rejected_count
        accuracy = (approved_count / total_qa * 100.0) if total_qa > 0 else 100.0
        
        ppu_earnings = (
            db.query(func.sum(Task.cost))
            .join(Annotation, Task.id == Annotation.task_id)
            .filter(Annotation.created_by_id == user.id)
            .scalar()
        ) or 0.0
        
        leaderboard.append({
            "username": user.username,
            "tasks_completed": tasks_completed,
            "accuracy_rating": round(accuracy, 2),
            "ppu_earnings": round(ppu_earnings, 2)
        })
        
    # Sort leaderboard by tasks_completed descending, then accuracy_rating descending
    leaderboard.sort(key=lambda x: (x["tasks_completed"], x["accuracy_rating"]), reverse=True)
    
    CacheService.set(cache_key, leaderboard, expire_seconds=300)
    return leaderboard

