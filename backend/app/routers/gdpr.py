from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.auth import AuthService
from app.models.user import User
from app.models.annotation import Annotation
from app.models.qa import QAResult
from app.models.task import Task
from app.services.audit import AuditService
from pydantic import BaseModel
from typing import Optional
import datetime
from app.core.security import get_password_hash
import secrets

router = APIRouter(prefix="/user", tags=["GDPR"])

class GDPRConsentRequest(BaseModel):
    username: Optional[str] = None
    consent: bool

@router.post("/gdpr-consent")
def gdpr_consent(
    req: GDPRConsentRequest,
    db: Session = Depends(get_db)
):
    username = req.username
    if not username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username must be specified for consent update"
        )
        
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
        
    user.gdpr_consent = req.consent
    user.gdpr_consent_date = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    db.commit()
    
    AuditService.log_action(
        user_id=user.id,
        username=user.username,
        action="GDPR_CONSENT",
        resource_type="user",
        resource_id=user.id,
        details={"consent": req.consent}
    )
    return {"message": "GDPR consent status updated successfully."}

@router.delete("/erasure")
def gdpr_erasure(
    db: Session = Depends(get_db),
    current_user: User = Depends(AuthService.get_current_user)
):
    """
    Permanently deletes the current user account (Right to be Forgotten).
    Anonymizes all annotations and QA reviews created by this user to preserve project integrity.
    """
    # 1. Get or create special "anonymized" user
    anonymized_user = db.query(User).filter(User.username == "anonymized").first()
    if not anonymized_user:
        random_password = secrets.token_hex(16)
        anonymized_user = User(
            username="anonymized",
            hashed_password=get_password_hash(random_password),
            role="annotator",
            email="anonymized@trainlyft.ai",
            gdpr_consent=True,
            gdpr_consent_date=datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        )
        db.add(anonymized_user)
        db.commit()
        db.refresh(anonymized_user)
        
    # 2. Update annotations to use anonymized user
    annotations_to_update = db.query(Annotation).filter(Annotation.created_by_id == current_user.id).all()
    for annotation in annotations_to_update:
        annotation.created_by_id = anonymized_user.id
        
    # 3. Update QA results to use anonymized user
    qa_results_to_update = db.query(QAResult).filter(QAResult.reviewer_id == current_user.id).all()
    for qa in qa_results_to_update:
        qa.reviewer_id = anonymized_user.id
        
    # 4. Unassign any pending/in-progress tasks assigned to this user
    tasks_to_unassign = db.query(Task).filter(Task.assigned_to_id == current_user.id).all()
    for task in tasks_to_unassign:
        task.assigned_to_id = None
        if task.status == "in-progress":
            task.status = "pending"
            
    # Save user details before deleting
    user_id = current_user.id
    username = current_user.username
    
    # 5. Delete the user
    db.delete(current_user)
    db.commit()
    
    AuditService.log_action(
        user_id=user_id,
        username=username,
        action="GDPR_ERASURE",
        resource_type="user",
        resource_id=user_id,
        details={"anonymized": True}
    )
    
    return {"message": "Account successfully erased. All data anonymized."}
