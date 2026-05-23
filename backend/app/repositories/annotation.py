from sqlalchemy.orm import Session
from typing import List, Optional
from app.repositories.base import BaseRepository
from app.models.annotation import Annotation
from app.schemas.annotation import AnnotationCreate

class AnnotationRepository(BaseRepository):
    def get_by_id(self, annotation_id: int) -> Annotation:
        return self.db.query(Annotation).filter(Annotation.id == annotation_id).first()

    def get_by_task_id(self, task_id: int) -> List[Annotation]:
        return (
            self.db.query(Annotation)
            .filter(Annotation.task_id == task_id)
            .order_by(Annotation.version.desc())
            .all()
        )

    def get_latest_by_task_id(self, task_id: int) -> Optional[Annotation]:
        return (
            self.db.query(Annotation)
            .filter(Annotation.task_id == task_id)
            .order_by(Annotation.version.desc())
            .first()
        )

    def create(self, annotation_in: AnnotationCreate, creator_id: int) -> Annotation:
        # Determine the next version number
        latest = self.get_latest_by_task_id(annotation_in.task_id)
        next_version = (latest.version + 1) if latest else 1

        db_annotation = Annotation(
            task_id=annotation_in.task_id,
            label=annotation_in.label,
            confidence=annotation_in.confidence if annotation_in.confidence is not None else 1.0,
            created_by_id=creator_id,
            version=next_version,
            corrected_label=annotation_in.corrected_label
        )
        self.db.add(db_annotation)
        self.db.commit()
        self.db.refresh(db_annotation)
        return db_annotation
