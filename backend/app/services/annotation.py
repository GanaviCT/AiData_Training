from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.repositories.annotation import AnnotationRepository
from app.repositories.task import TaskRepository
from app.models.annotation import Annotation
from app.schemas.annotation import AnnotationCreate
from app.schemas.task import TaskUpdate

class AnnotationService:
    def __init__(self, db: Session = Depends(get_db)):
        self.db = db
        self.annotation_repo = AnnotationRepository(db)
        self.task_repo = TaskRepository(db)

    def create_annotation(self, annotation_in: AnnotationCreate, user_id: int) -> Annotation:
        task = self.task_repo.get_by_id(annotation_in.task_id)
        if not task:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Task with ID {annotation_in.task_id} not found"
            )
        
        # Create the annotation
        db_annotation = self.annotation_repo.create(annotation_in, user_id)

        # Update task status to completed (awaiting QA)
        self.task_repo.update(task, TaskUpdate(status="completed"))

        # Send email notifications to the selected reviewer/admin (or all as fallback)
        try:
            from app.repositories.user import UserRepository
            from app.services.email import EmailService
            user_repo = UserRepository(self.db)
            annotator = user_repo.get_by_id(user_id)
            annotator_email = annotator.email or (annotator.username if annotator and "@" in annotator.username else None)
            
            if annotation_in.recipient_email:
                EmailService.send_qa_submission_email(
                    annotator_username=annotator.username if annotator else "annotator",
                    task_id=task.id,
                    task_type=task.type,
                    recipient_email=annotation_in.recipient_email,
                    annotator_email=annotator_email
                )
            else:
                # Find all reviewers and admins with active email addresses
                all_users = user_repo.list_users()
                for u in all_users:
                    u_email = u.email or (u.username if "@" in u.username else None)
                    if u.role.lower() in ["reviewer", "admin"] and u_email:
                        EmailService.send_qa_submission_email(
                            annotator_username=annotator.username if annotator else "annotator",
                            task_id=task.id,
                            task_type=task.type,
                            recipient_email=u_email,
                            annotator_email=annotator_email
                        )
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Failed to send QA submission emails: {e}")

        return db_annotation

    def get_annotations_for_task(self, task_id: int) -> List[Annotation]:
        return self.annotation_repo.get_by_task_id(task_id)
