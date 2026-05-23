from sqlalchemy.orm import Session
from sqlalchemy import func
from app.repositories.base import BaseRepository
from app.models.qa import QAResult
from app.models.annotation import Annotation
from app.schemas.qa import QAReviewRequest, QAStats

class QARepository(BaseRepository):
    def create_review(self, review_in: QAReviewRequest, reviewer_id: int) -> QAResult:
        db_qa = QAResult(
            annotation_id=review_in.annotation_id,
            approved=review_in.approved,
            reviewer_id=reviewer_id,
            comments=review_in.comments
        )
        self.db.add(db_qa)
        self.db.commit()
        self.db.refresh(db_qa)
        return db_qa

    def get_stats(self) -> QAStats:
        total = self.db.query(func.count(QAResult.id)).scalar() or 0
        approved = self.db.query(func.count(QAResult.id)).filter(QAResult.approved == True).scalar() or 0
        rejected = total - approved
        accuracy = (approved / total * 100.0) if total > 0 else 0.0

        return QAStats(
            total_reviewed=total,
            approved_count=approved,
            rejected_count=rejected,
            accuracy_percentage=round(accuracy, 2)
        )
