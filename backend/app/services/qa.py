from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.repositories.qa import QARepository
from app.repositories.annotation import AnnotationRepository
from app.repositories.task import TaskRepository
from app.models.qa import QAResult
from app.schemas.qa import QAReviewRequest, QAStats
from app.schemas.task import TaskUpdate
from app.models.user import User
import logging

logger = logging.getLogger(__name__)

class QAService:
    def __init__(self, db: Session = Depends(get_db)):
        self.db = db
        self.qa_repo = QARepository(db)
        self.annotation_repo = AnnotationRepository(db)
        self.task_repo = TaskRepository(db)

    def submit_review(self, review_in: QAReviewRequest, reviewer_id: int) -> QAResult:
        annotation = self.annotation_repo.get_by_id(review_in.annotation_id)
        if not annotation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Annotation with ID {review_in.annotation_id} not found"
            )

        task = self.task_repo.get_by_id(annotation.task_id)
        if not task:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Task associated with annotation not found"
            )

        # Create QA Result log
        db_qa = self.qa_repo.create_review(review_in, reviewer_id)

        # Determine task status based on review approval
        new_status = "completed" if review_in.approved else "rejected"
        self.task_repo.update(task, TaskUpdate(status=new_status))

        # Send email notification to the annotator who submitted
        try:
            submitter = self.db.query(User).filter(User.id == annotation.created_by_id).first()
            reviewer = self.db.query(User).filter(User.id == reviewer_id).first()
            if submitter and submitter.email:
                from app.services.email import EmailService
                EmailService.send_qa_review_email(
                    submitter_username=submitter.username,
                    reviewer_username=reviewer.username if reviewer else "admin",
                    recipient_email=submitter.email,
                    task_id=task.id,
                    task_type=task.type,
                    task_data=task.data[:200] if task.type == 'text' else task.data,
                    label=annotation.label,
                    confidence=annotation.confidence,
                    approved=review_in.approved,
                    comments=review_in.comments or ""
                )
        except Exception as e:
            logger.warning(f"Failed to send QA review email: {e}")

        return db_qa

    def get_stats(self) -> QAStats:
        return self.qa_repo.get_stats()

    def get_audit_sample(self, percentage: float = None, count: int = None):
        import random
        import math
        
        # 1. Fetch tasks with completed status (awaiting review or finished review)
        completed_tasks = self.task_repo.list_tasks(status="completed")
        
        # 2. Filter tasks whose latest annotation has not been reviewed
        pending_review_tasks = []
        for task in completed_tasks:
            if not task.annotations:
                continue
            # Get latest annotation by sorting on version (or ID / created_at)
            latest_annotation = sorted(task.annotations, key=lambda a: a.version)[-1]
            if not latest_annotation.qa_results:
                pending_review_tasks.append(task)
                
        # 3. Apply sampling logic
        total_pending = len(pending_review_tasks)
        if total_pending == 0:
            return []
            
        sample_size = total_pending
        if count is not None:
            sample_size = min(count, total_pending)
        elif percentage is not None:
            sample_size = math.ceil(total_pending * (percentage / 100.0))
            sample_size = max(1, min(sample_size, total_pending))
            
        return random.sample(pending_review_tasks, sample_size)


