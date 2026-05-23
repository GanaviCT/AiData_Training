import os
import json
import zipfile
import datetime
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.user import User
from app.models.task import Task
from app.models.annotation import Annotation
from app.models.qa import QAResult
from app.core.mongodb import get_mongo_db
import threading
import time

BACKUP_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "backups"))

class BackupService:
    _scheduler_thread = None
    _stop_scheduler = threading.Event()

    @staticmethod
    def ensure_backup_dir():
        if not os.path.exists(BACKUP_DIR):
            os.makedirs(BACKUP_DIR)

    @staticmethod
    def export_backup(db: Session) -> str:
        """
        Exports all databases to a zip file containing a single data.json and returns the filepath.
        """
        BackupService.ensure_backup_dir()
        
        # 1. Fetch SQL data
        users = db.query(User).all()
        tasks = db.query(Task).all()
        annotations = db.query(Annotation).all()
        qa_results = db.query(QAResult).all()

        users_data = []
        for u in users:
            users_data.append({
                "id": u.id,
                "username": u.username,
                "hashed_password": u.hashed_password,
                "role": u.role,
                "email": u.email,
                "mfa_enabled": u.mfa_enabled,
                "mfa_secret": u.mfa_secret,
                "gdpr_consent": u.gdpr_consent,
                "gdpr_consent_date": u.gdpr_consent_date
            })

        tasks_data = []
        for t in tasks:
            tasks_data.append({
                "id": t.id,
                "type": t.type,
                "data": t.data,
                "status": t.status,
                "priority": t.priority,
                "assigned_to_id": t.assigned_to_id,
                "cost": t.cost,
                "import_source": t.import_source,
                "lineage_history": t.lineage_history
            })

        annotations_data = []
        for a in annotations:
            annotations_data.append({
                "id": a.id,
                "task_id": a.task_id,
                "label": a.label,
                "confidence": a.confidence,
                "created_by_id": a.created_by_id,
                "version": a.version,
                "corrected_label": a.corrected_label,
                "created_at": a.created_at.isoformat() if a.created_at else None
            })

        qa_data = []
        for q in qa_results:
            qa_data.append({
                "id": q.id,
                "annotation_id": q.annotation_id,
                "approved": q.approved,
                "reviewer_id": q.reviewer_id,
                "comments": q.comments,
                "created_at": q.created_at.isoformat() if q.created_at else None
            })

        # 2. Fetch MongoDB audit logs
        mongo_db = get_mongo_db()
        logs_cursor = mongo_db.audit_logs.find({})
        logs_data = []
        for doc in logs_cursor:
            doc_copy = doc.copy()
            doc_copy["_id"] = str(doc_copy["_id"])
            if isinstance(doc_copy.get("timestamp"), datetime.datetime):
                doc_copy["timestamp"] = doc_copy["timestamp"].isoformat()
            logs_data.append(doc_copy)

        # 3. Assemble JSON
        backup_payload = {
            "version": "1.0",
            "timestamp": datetime.datetime.utcnow().isoformat(),
            "users": users_data,
            "tasks": tasks_data,
            "annotations": annotations_data,
            "qa_results": qa_data,
            "audit_logs": logs_data
        }

        # 4. Save to zip
        timestamp_str = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"backup_{timestamp_str}.zip"
        zip_path = os.path.join(BACKUP_DIR, filename)

        temp_json_path = os.path.join(BACKUP_DIR, f"temp_{timestamp_str}.json")
        with open(temp_json_path, "w") as f:
            json.dump(backup_payload, f, indent=2)

        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
            zipf.write(temp_json_path, "data.json")

        os.remove(temp_json_path)
        return zip_path

    @staticmethod
    def restore_backup(db: Session, zip_path: str):
        """
        Restores data from a zip backup file.
        """
        if not os.path.exists(zip_path):
            raise FileNotFoundError(f"Backup file not found at {zip_path}")

        # 1. Unzip data.json
        with zipfile.ZipFile(zip_path, "r") as zipf:
            data_json_bytes = zipf.read("data.json")
            backup_payload = json.loads(data_json_bytes.decode("utf-8"))

        # 2. Delete existing data in reverse order of dependencies
        db.query(QAResult).delete()
        db.query(Annotation).delete()
        db.query(Task).delete()
        db.query(User).delete()
        db.commit()

        # 3. Restore Users
        for u in backup_payload.get("users", []):
            db_user = User(
                id=u["id"],
                username=u["username"],
                hashed_password=u["hashed_password"],
                role=u["role"],
                email=u.get("email"),
                mfa_enabled=u.get("mfa_enabled", False),
                mfa_secret=u.get("mfa_secret"),
                gdpr_consent=u.get("gdpr_consent", False),
                gdpr_consent_date=u.get("gdpr_consent_date")
            )
            db.add(db_user)
        db.commit()

        # 4. Restore Tasks
        for t in backup_payload.get("tasks", []):
            db_task = Task(
                id=t["id"],
                type=t["type"],
                data=t["data"],
                status=t["status"],
                priority=t["priority"],
                assigned_to_id=t.get("assigned_to_id"),
                cost=t.get("cost", 0.0),
                import_source=t.get("import_source", "single"),
                lineage_history=t.get("lineage_history")
            )
            db.add(db_task)
        db.commit()

        # 5. Restore Annotations
        for a in backup_payload.get("annotations", []):
            created_at_val = datetime.datetime.fromisoformat(a["created_at"]) if a.get("created_at") else None
            db_annotation = Annotation(
                id=a["id"],
                task_id=a["task_id"],
                label=a["label"],
                confidence=a["confidence"],
                created_by_id=a["created_by_id"],
                version=a.get("version", 1),
                corrected_label=a.get("corrected_label"),
                created_at=created_at_val
            )
            db.add(db_annotation)
        db.commit()

        # 6. Restore QAResults
        for q in backup_payload.get("qa_results", []):
            created_at_val = datetime.datetime.fromisoformat(q["created_at"]) if q.get("created_at") else None
            db_qa = QAResult(
                id=q["id"],
                annotation_id=q["annotation_id"],
                approved=q["approved"],
                reviewer_id=q["reviewer_id"],
                comments=q.get("comments"),
                created_at=created_at_val
            )
            db.add(db_qa)
        db.commit()

        # 7. Restore MongoDB Audit Logs
        mongo_db = get_mongo_db()
        mongo_db.audit_logs.delete_many({}) # clear current logs
        
        logs_to_insert = []
        for l in backup_payload.get("audit_logs", []):
            l.pop("_id", None)
            if "timestamp" in l:
                try:
                    ts_str = l["timestamp"]
                    if ts_str.endswith("Z"):
                        ts_str = ts_str[:-1]
                    l["timestamp"] = datetime.datetime.fromisoformat(ts_str)
                except Exception:
                    l["timestamp"] = datetime.datetime.utcnow()
            logs_to_insert.append(l)
            
        if logs_to_insert:
            mongo_db.audit_logs.insert_many(logs_to_insert)

    @staticmethod
    def get_backups_list() -> list:
        BackupService.ensure_backup_dir()
        files = os.listdir(BACKUP_DIR)
        backups = []
        for f in files:
            if f.startswith("backup_") and f.endswith(".zip"):
                path = os.path.join(BACKUP_DIR, f)
                stat = os.stat(path)
                backups.append({
                    "filename": f,
                    "size_bytes": stat.st_size,
                    "created_at": datetime.datetime.fromtimestamp(stat.st_mtime).isoformat()
                })
        backups.sort(key=lambda x: x["created_at"], reverse=True)
        return backups

    @staticmethod
    def _run_scheduler():
        """
        A background task to auto-run backup daily.
        """
        while not BackupService._stop_scheduler.is_set():
            try:
                db = SessionLocal()
                backups = BackupService.get_backups_list()
                should_backup = True
                if backups:
                    newest = backups[0]
                    newest_time = datetime.datetime.fromisoformat(newest["created_at"])
                    if (datetime.datetime.now() - newest_time).total_seconds() < 86400:
                        should_backup = False
                        
                if should_backup:
                    BackupService.export_backup(db)
                    print(f"[BackupService] Daily backup generated successfully.")
                db.close()
            except Exception as e:
                print(f"[BackupService] Scheduler error: {e}")
            
            # Check every hour
            for _ in range(3600):
                if BackupService._stop_scheduler.is_set():
                    break
                time.sleep(1)

    @staticmethod
    def start_scheduler():
        if BackupService._scheduler_thread is None:
            BackupService._stop_scheduler.clear()
            BackupService._scheduler_thread = threading.Thread(target=BackupService._run_scheduler, daemon=True)
            BackupService._scheduler_thread.start()
            print("[BackupService] Scheduler started.")

    @staticmethod
    def stop_scheduler():
        if BackupService._scheduler_thread is not None:
            BackupService._stop_scheduler.set()
            BackupService._scheduler_thread.join()
            BackupService._scheduler_thread = None
            print("[BackupService] Scheduler stopped.")
