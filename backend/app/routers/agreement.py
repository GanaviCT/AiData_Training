from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.auth import RoleChecker, PermissionChecker
from app.services.agreement import AgreementService
from app.services.audit import AuditService
from app.models.user import User
from app.models.task import Task
from app.models.annotation import Annotation
from app.core.security import get_password_hash
from datetime import datetime
import logging
from app.services.cache import CacheService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/annotations", tags=["Agreement (IAA)"])

@router.get("/agreement", status_code=status.HTTP_200_OK)
def get_agreement_metrics(
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("system:view"))
):
    """
    Fetch calculated Inter-Annotator Agreement (IAA) metrics including:
    - Human-to-Human agreement (Fleiss' Kappa, percentage agreement)
    - Human-to-AI agreement
    - Human-to-QA agreement
    """
    try:
        cache_key = "agreement:metrics"
        cached_val = CacheService.get(cache_key)
        if cached_val is not None:
            return cached_val
            
        res = AgreementService.calculate_iaa(db)
        CacheService.set(cache_key, res, expire_seconds=300)
        return res
    except Exception as e:
        logger.error(f"Error calculating agreement metrics: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to calculate agreement metrics: {str(e)}"
        )

@router.post("/seed-iaa", status_code=status.HTTP_201_CREATED)
def seed_iaa_demo_data(
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("system:debug"))
):
    """
    Seeds demo tasks with multiple annotations from distinct users to
    showcase the Fleiss' Kappa and Inter-Annotator Agreement calculation live.
    """
    try:
        # 1. Ensure mock annotator users exist
        mock_annotators = [
            {"username": "alice_vance", "email": "alice.vance@company.com"},
            {"username": "bob_chen", "email": "bob.chen@company.com"},
            {"username": "carol_martinez", "email": "carol.martinez@company.com"}
        ]
        
        users = []
        for mock in mock_annotators:
            user = db.query(User).filter(User.username == mock["username"]).first()
            if not user:
                user = User(
                    username=mock["username"],
                    hashed_password=get_password_hash("password123"),
                    role="annotator",
                    email=mock["email"]
                )
                db.add(user)
                db.commit()
                db.refresh(user)
            users.append(user)
            
        alice, bob, carol = users[0], users[1], users[2]
        
        # 2. Define the tasks and annotations list
        # Task data: (text, priority, annotations_list)
        # annotations_list format: (user_obj, label, confidence, corrected_label)
        demo_data = [
            (
                "The new UI is absolutely fantastic and super responsive!",
                "high",
                [
                    (alice, "Positive", 1.0, None),
                    (bob, "Positive", 1.0, None),
                    (carol, "Positive", 1.0, None)
                ]
            ),
            (
                "The customer service was average. Not bad but could be better.",
                "medium",
                [
                    (alice, "Neutral", 1.0, None),
                    (bob, "Positive", 1.0, None),
                    (carol, "Neutral", 1.0, None)
                ]
            ),
            (
                "I am extremely disappointed. The system crashed twice today!",
                "high",
                [
                    (alice, "Negative", 1.0, None),
                    (bob, "Negative", 1.0, None),
                    (carol, "Negative", 1.0, None)
                ]
            ),
            (
                "I received my order, but the package was slightly torn.",
                "medium",
                [
                    (alice, "Neutral", 1.0, None),
                    (bob, "Negative", 1.0, None),
                    (carol, "Positive", 1.0, None)
                ]
            ),
            (
                "The shipping was lightning fast! It arrived within 24 hours.",
                "low",
                [
                    (alice, "Positive", 1.0, None),
                    (bob, "Positive", 1.0, None),
                    (carol, "Positive", 1.0, None)
                ]
            )
        ]
        
        seeded_tasks_count = 0
        seeded_annotations_count = 0
        
        for idx, (text, priority, annotators_ratings) in enumerate(demo_data):
            # Calculate Simulated PPU Cost
            base_cost = 0.50
            priority_multiplier = 1.5 if priority == "high" else (1.25 if priority == "medium" else 1.0)
            cost = round(base_cost * priority_multiplier, 2)
            
            # Create Task
            task = Task(
                type="text",
                data=text,
                priority=priority,
                status="completed", # complete so it's ready for audit/review
                cost=cost,
                import_source=f"iaa_demo_{int(datetime.utcnow().timestamp())}"
            )
            db.add(task)
            db.commit()
            db.refresh(task)
            seeded_tasks_count += 1
            
            # Create Annotations
            for u_obj, label, conf, corr_label in annotators_ratings:
                # Find latest annotation version for version count
                latest_ann = db.query(Annotation).filter(
                    Annotation.task_id == task.id
                ).order_by(Annotation.version.desc()).first()
                v = (latest_ann.version + 1) if latest_ann else 1
                
                ann = Annotation(
                    task_id=task.id,
                    label=label,
                    confidence=conf,
                    created_by_id=u_obj.id,
                    version=v,
                    corrected_label=corr_label
                )
                db.add(ann)
                db.commit()
                seeded_annotations_count += 1
                
        # 3. Log Audit Action to MongoDB
        AuditService.log_action(
            user_id=current_user.id,
            username=current_user.username,
            action="SEED_IAA_DATA",
            resource_type="dataset",
            resource_id=seeded_tasks_count,
            details={
                "tasks_created": seeded_tasks_count,
                "annotations_created": seeded_annotations_count
            }
        )
        
        # Clear caches
        CacheService.clear_pattern("dashboard:*")
        CacheService.clear_pattern("agreement:*")

        return {
            "message": "Successfully seeded IAA demonstration data!",
            "tasks_seeded": seeded_tasks_count,
            "annotations_seeded": seeded_annotations_count
        }
    except Exception as e:
        db.rollback()
        logger.error(f"Error seeding IAA demo data: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to seed demo data: {str(e)}"
        )
