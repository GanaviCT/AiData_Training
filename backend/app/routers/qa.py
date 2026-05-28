from fastapi import APIRouter, Depends, status
from typing import List, Optional
from app.services.qa import QAService
from app.services.auth import AuthService, RoleChecker, PermissionChecker
from app.schemas.qa import QAReviewRequest, QAResultOut, QAStats
from app.schemas.task import TaskOut
from app.models.user import User
from app.services.audit import AuditService
from app.services.cache import CacheService

router = APIRouter(prefix="/qa", tags=["Quality Assurance"])

@router.post("/review", response_model=QAResultOut, status_code=status.HTTP_201_CREATED)
def submit_review(
    review_req: QAReviewRequest,
    qa_service: QAService = Depends(),
    current_user: User = Depends(PermissionChecker("qa:submit"))
):
    res = qa_service.submit_review(review_req, current_user.id)
    
    # Clear caches
    CacheService.clear_pattern("dashboard:*")
    CacheService.clear_pattern("agreement:*")

    action = "QA_APPROVE" if review_req.approved else "QA_REJECT"
    AuditService.log_action(
        user_id=current_user.id,
        username=current_user.username,
        action=action,
        resource_type="qa_result",
        resource_id=res.id,
        details={
            "annotation_id": res.annotation_id,
            "comments": res.comments
        }
    )
    return res

@router.get("/stats", response_model=QAStats)
def get_qa_stats(
    qa_service: QAService = Depends(),
    current_user: User = Depends(AuthService.get_current_user)
):
    return qa_service.get_stats()

@router.get("/sample", response_model=List[TaskOut])
def get_audit_sample(
    percentage: Optional[float] = None,
    count: Optional[int] = None,
    qa_service: QAService = Depends(),
    current_user: User = Depends(PermissionChecker("qa:sample"))
):
    return qa_service.get_audit_sample(percentage=percentage, count=count)

