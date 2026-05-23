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

        return db_annotation

    def get_annotations_for_task(self, task_id: int) -> List[Annotation]:
        return self.annotation_repo.get_by_task_id(task_id)
