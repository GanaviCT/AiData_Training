import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import engine, Base, SessionLocal
from app.core.config import settings
from app.models.user import User
from app.models.task import Task
from app.models.annotation import Annotation
from app.models.qa import QAResult
from app.core.security import get_password_hash
from app.routers import auth, tasks, annotations, qa, ai, training, dashboard, audit, agreement, mfa, gdpr, backup, queue, system

# Initialize logging and trigger watcher update
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Full-stack AI-powered Data & Training Platform POC",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For local POC development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure Process Time Middleware (SLA compliance tracking)
import time
from fastapi import Request

@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    
    path = request.url.path
    if path.startswith("/api") and not path.startswith("/api/system/health"):
        try:
            from app.routers.system import track_request
            track_request(path, process_time, response.status_code)
        except Exception:
            pass
            
    return response

# Register routers
app.include_router(auth.router, prefix="/api")
app.include_router(tasks.router, prefix="/api")
app.include_router(agreement.router, prefix="/api")
app.include_router(annotations.router, prefix="/api")
app.include_router(qa.router, prefix="/api")
app.include_router(ai.router, prefix="/api")
app.include_router(training.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(audit.router, prefix="/api")
app.include_router(mfa.router, prefix="/api")
app.include_router(gdpr.router, prefix="/api")
app.include_router(backup.router, prefix="/api")
app.include_router(queue.router, prefix="/api")
app.include_router(system.router, prefix="/api")

# Database Seeding on Startup
@app.on_event("startup")
def seed_database():
    from app.services.backup import BackupService
    from app.services.queue import BackgroundQueueService
    BackupService.start_scheduler()
    BackgroundQueueService.initialize()
    db = SessionLocal()
    try:
        # Ensure 'email' column exists in 'users' table (Lightweight SQLite migration)
        from sqlalchemy import text
        try:
            db.execute(text("ALTER TABLE users ADD COLUMN email VARCHAR"))
            db.commit()
            logger.info("Database migration: Added email column to users table.")
        except Exception:
            db.rollback()

        # Add MFA and GDPR columns to users table
        for col_name, col_type in [
            ("mfa_enabled", "BOOLEAN DEFAULT FALSE"),
            ("mfa_secret", "VARCHAR"),
            ("gdpr_consent", "BOOLEAN DEFAULT FALSE"),
            ("gdpr_consent_date", "VARCHAR")
        ]:
            try:
                db.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}"))
                db.commit()
                logger.info(f"Database migration: Added {col_name} column to users table.")
            except Exception:
                db.rollback()

        # Ensure 'import_source' column exists in 'tasks' table
        try:
            db.execute(text("ALTER TABLE tasks ADD COLUMN import_source VARCHAR DEFAULT 'single'"))
            db.commit()
            logger.info("Database migration: Added import_source column to tasks table.")
        except Exception:
            db.rollback()

        # Add lineage_history column to tasks table
        try:
            db.execute(text("ALTER TABLE tasks ADD COLUMN lineage_history VARCHAR"))
            db.commit()
            logger.info("Database migration: Added lineage_history column to tasks table.")
        except Exception:
            db.rollback()

        # Create indexes for database optimization / scalability (NFR-5.1)
        for idx_name, idx_sql in [
            ("idx_tasks_status_priority", "CREATE INDEX idx_tasks_status_priority ON tasks (status, priority)"),
            ("idx_tasks_assigned_to", "CREATE INDEX idx_tasks_assigned_to ON tasks (assigned_to_id)"),
            ("idx_annotations_task", "CREATE INDEX idx_annotations_task ON annotations (task_id)"),
            ("idx_qa_results_annotation", "CREATE INDEX idx_qa_results_annotation ON qa_results (annotation_id)")
        ]:
            try:
                db.execute(text(idx_sql))
                db.commit()
                logger.info(f"Database migration: Created index {idx_name}.")
            except Exception:
                db.rollback()

        # 1. Seed users
        if db.query(User).count() == 0:
            logger.info("No users found. Seeding default accounts...")
            users = [
                User(username="admin", hashed_password=get_password_hash("admin123"), role="admin", email="ganuyogi4@gmail.com"),
                User(username="annotator", hashed_password=get_password_hash("annotator123"), role="annotator", email="ganuyogi4@gmail.com"),
                User(username="reviewer", hashed_password=get_password_hash("reviewer123"), role="reviewer", email="ganuyogi4@gmail.com"),
            ]
            db.add_all(users)
            db.commit()
            logger.info("Successfully seeded Admin, Annotator, and Reviewer accounts with default emails.")
        else:
            # Set default email for existing demo users if not set
            for username in ["admin", "annotator", "reviewer"]:
                user = db.query(User).filter(User.username == username).first()
                if user and not user.email:
                    user.email = "ganuyogi4@gmail.com"
            db.commit()

        # 1.1 Seed realistic demo users
        demo_users = [
            {"username": "alice_vance", "role": "annotator", "email": "alice.vance@company.com"},
            {"username": "bob_chen", "role": "annotator", "email": "bob.chen@company.com"},
            {"username": "carol_martinez", "role": "annotator", "email": "carol.martinez@company.com"},
            {"username": "david_miller", "role": "annotator", "email": "david.miller@company.com"},
            {"username": "emily_watson", "role": "reviewer", "email": "emily.watson@company.com"},
            {"username": "frank_cooper", "role": "reviewer", "email": "frank.cooper@company.com"},
            {"username": "grace_hopper", "role": "admin", "email": "grace.hopper@company.com"}
        ]
        
        for du in demo_users:
            try:
                existing = db.query(User).filter(User.username == du["username"]).first()
                if not existing:
                    new_user = User(
                        username=du["username"],
                        hashed_password=get_password_hash("password123"),
                        role=du["role"],
                        email=du["email"]
                    )
                    db.add(new_user)
                    db.commit()
                    logger.info(f"Seeding demo user: {du['username']} ({du['role']})")
            except Exception as e:
                db.rollback()
                logger.error(f"Error seeding user {du['username']}: {str(e)}")

        # 2. Seed some sample tasks
        if db.query(Task).count() == 0:
            logger.info("No tasks found. Seeding sample tasks...")
            
            # Simple text tasks
            sample_texts = [
                ("I absolutely love this new dataset platform! The user interface is so fast and clean.", "high"),
                ("The customer service response was incredibly slow and frustrating, I want a refund.", "medium"),
                ("Today is a sunny day and I went for a quick walk in the local park.", "low"),
                ("The product works okay but it is a bit overpriced for what it offers.", "medium"),
                ("My order has not arrived yet, and I have not received any shipment tracking updates.", "high")
            ]
            
            tasks = []
            for text, priority in sample_texts:
                # Calculate simulated PPU cost
                base_cost = 0.50
                priority_multiplier = 1.5 if priority == "high" else (1.25 if priority == "medium" else 1.0)
                complexity_bonus = min(0.50, len(text) / 1000.0)
                cost = round((base_cost * priority_multiplier) + complexity_bonus, 2)
                
                tasks.append(
                    Task(
                        type="text",
                        data=text,
                        priority=priority,
                        status="pending",
                        cost=cost
                    )
                )

            # Simple image tasks (using Unsplash placeholders)
            sample_images = [
                ("https://images.unsplash.com/photo-1541963463532-d68292c34b19?w=800", "medium"),
                ("https://images.unsplash.com/photo-1503023345310-bd7c1de61c7d?w=800", "low"),
                ("https://images.unsplash.com/photo-1472214222541-d510753a4707?w=800", "high")
            ]
            for img_url, priority in sample_images:
                priority_multiplier = 1.5 if priority == "high" else (1.25 if priority == "medium" else 1.0)
                cost = round(1.50 * priority_multiplier, 2)
                tasks.append(
                    Task(
                        type="image",
                        data=img_url,
                        priority=priority,
                        status="pending",
                        cost=cost
                    )
                )

            # Simple video tasks (using public open-source sample video URLs)
            sample_videos = [
                ("https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4", "medium"),
                ("https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4", "low"),
                ("https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4", "high")
            ]
            for vid_url, priority in sample_videos:
                priority_multiplier = 1.5 if priority == "high" else (1.25 if priority == "medium" else 1.0)
                cost = round(2.50 * priority_multiplier, 2)  # Videos carry a higher base complexity cost
                tasks.append(
                    Task(
                        type="video",
                        data=vid_url,
                        priority=priority,
                        status="pending",
                        cost=cost
                    )
                )

            db.add_all(tasks)
            db.commit()
            logger.info("Successfully seeded 11 sample tasks (5 text, 3 image, 3 video).")

    except Exception as e:
        logger.error(f"Error seeding database: {str(e)}")
    finally:
        db.close()

@app.get("/")
def read_root():
    return {"message": "Welcome to the AI Data & Training Platform API!"}

@app.on_event("shutdown")
def shutdown_event():
    from app.services.backup import BackupService
    from app.services.queue import BackgroundQueueService
    BackupService.stop_scheduler()
    BackgroundQueueService.shutdown()
