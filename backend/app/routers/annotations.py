from fastapi import APIRouter, Depends, status
from typing import List
from app.services.annotation import AnnotationService
from app.services.auth import AuthService, RoleChecker
from app.schemas.annotation import AnnotationCreate, AnnotationOut
from app.models.user import User
from app.services.audit import AuditService
from app.services.cache import CacheService

router = APIRouter(prefix="/annotations", tags=["Annotations"])

@router.post("", response_model=AnnotationOut, status_code=status.HTTP_201_CREATED)
def create_annotation(
    annotation_in: AnnotationCreate,
    annotation_service: AnnotationService = Depends(),
    current_user: User = Depends(RoleChecker(["annotator", "admin"]))
):
    ann = annotation_service.create_annotation(annotation_in, current_user.id)
    
    # Clear caches
    CacheService.clear_pattern("dashboard:*")
    CacheService.clear_pattern("agreement:*")

    AuditService.log_action(
        user_id=current_user.id,
        username=current_user.username,
        action="ANNOTATION_CREATE",
        resource_type="annotation",
        resource_id=ann.id,
        details={
            "task_id": ann.task_id,
            "label": ann.label
        }
    )
    return ann

@router.get("/{taskId}", response_model=List[AnnotationOut])
def get_annotations_for_task(
    taskId: int,
    annotation_service: AnnotationService = Depends(),
    current_user: User = Depends(AuthService.get_current_user)
):
    return annotation_service.get_annotations_for_task(taskId)
