import asyncio
import logging
import threading
import time
from typing import Dict, List, Any, Callable
import redis
from app.core.config import settings

logger = logging.getLogger(__name__)

# Metrics for Queue Monitoring
queue_metrics = {
    "total_queued": 0,
    "total_completed": 0,
    "total_failed": 0,
    "active_workers": 1,
    "start_time": time.time(),
}

job_history: List[Dict[str, Any]] = []

class BackgroundQueueService:
    _redis_client = None
    _use_redis = False
    _queue_thread = None
    _in_memory_queue: List[Dict[str, Any]] = []
    _running = False
    _handlers: Dict[str, Callable] = {}

    @classmethod
    def initialize(cls):
        """Initialize connection to Redis or fallback to in-memory queue"""
        cls._running = True
        try:
            cls._redis_client = redis.Redis(
                host=settings.REDIS_HOST,
                port=settings.REDIS_PORT,
                decode_responses=True,
                socket_connect_timeout=1
            )
            cls._redis_client.ping()
            cls._use_redis = True
            logger.info("BackgroundQueueService: Connected to Redis message broker.")
        except Exception as e:
            cls._use_redis = False
            cls._redis_client = None
            logger.warning(f"BackgroundQueueService: Redis not available ({str(e)}). Falling back to in-memory async message queue.")
        
        # Register default handlers
        cls.register_handler("EMAIL", cls._handle_email_job)
        cls.register_handler("BULK_IMPORT", cls._handle_bulk_import_job)
        cls.register_handler("ML_TRAIN", cls._handle_ml_train_job)

        # Start the background worker thread
        cls._queue_thread = threading.Thread(target=cls._worker_loop, daemon=True)
        cls._queue_thread.start()
        logger.info("BackgroundQueueService: Worker thread started.")

    @classmethod
    def register_handler(cls, job_type: str, handler: Callable[[Dict[str, Any]], None]):
        cls._handlers[job_type] = handler

    @classmethod
    def enqueue(cls, job_type: str, payload: Dict[str, Any]):
        """Enqueue a background task"""
        job_id = f"job_{int(time.time() * 1000)}"
        job = {
            "id": job_id,
            "type": job_type,
            "payload": payload,
            "status": "queued",
            "created_at": time.time(),
            "completed_at": None,
            "error": None
        }
        
        queue_metrics["total_queued"] += 1
        cls._add_to_history(job)

        if cls._use_redis:
            try:
                import json
                cls._redis_client.rpush("platform_jobs_queue", json.dumps(job))
                logger.info(f"Queued job {job_id} [{job_type}] in Redis.")
                return job_id
            except Exception as e:
                logger.error(f"Failed to queue to Redis: {str(e)}. Falling back to memory.")
        
        cls._in_memory_queue.append(job)
        logger.info(f"Queued job {job_id} [{job_type}] in memory queue.")
        return job_id

    @classmethod
    def get_status(cls) -> Dict[str, Any]:
        """Get current queue size, metrics, and job history"""
        queue_size = 0
        if cls._use_redis:
            try:
                queue_size = cls._redis_client.llen("platform_jobs_queue")
            except Exception:
                queue_size = len(cls._in_memory_queue)
        else:
            queue_size = len(cls._in_memory_queue)

        uptime = time.time() - queue_metrics["start_time"]
        throughput = queue_metrics["total_completed"] / max(1.0, uptime)
        
        return {
            "queue_backend": "Redis" if cls._use_redis else "In-Memory",
            "queue_size": queue_size,
            "total_queued": queue_metrics["total_queued"],
            "total_completed": queue_metrics["total_completed"],
            "total_failed": queue_metrics["total_failed"],
            "throughput_jobs_per_sec": round(throughput, 4),
            "active_workers": queue_metrics["active_workers"],
            "history": job_history[-15:]  # Return last 15 jobs
        }

    @classmethod
    def clear_history(cls):
        global job_history
        job_history.clear()
        queue_metrics["total_queued"] = 0
        queue_metrics["total_completed"] = 0
        queue_metrics["total_failed"] = 0

    @classmethod
    def shutdown(cls):
        cls._running = False
        logger.info("BackgroundQueueService: Worker thread shutting down.")

    @classmethod
    def _add_to_history(cls, job: Dict[str, Any]):
        global job_history
        # Keep list capped to prevent memory leak
        if len(job_history) > 100:
            job_history.pop(0)
        job_history.append(job)

    @classmethod
    def _update_job_status(cls, job_id: str, status: str, error: str = None):
        global job_history
        for job in job_history:
            if job["id"] == job_id:
                job["status"] = status
                job["completed_at"] = time.time()
                if error:
                    job["error"] = error
                break

    @classmethod
    def _worker_loop(cls):
        """Infinite loop consuming jobs from queue"""
        while cls._running:
            job = None
            
            # Fetch from Redis
            if cls._use_redis:
                try:
                    import json
                    raw_job = cls._redis_client.lpop("platform_jobs_queue")
                    if raw_job:
                        job = json.loads(raw_job)
                except Exception as e:
                    logger.error(f"Redis pop failed: {str(e)}")
                    cls._use_redis = False  # Temporary fallback
            
            # Fetch from memory queue
            if not job and cls._in_memory_queue:
                job = cls._in_memory_queue.pop(0)
            
            if not job:
                time.sleep(0.5)
                continue
            
            job_id = job["id"]
            job_type = job["type"]
            payload = job["payload"]
            
            cls._update_job_status(job_id, "processing")
            logger.info(f"Processing job {job_id} [{job_type}]...")
            
            try:
                handler = cls._handlers.get(job_type)
                if handler:
                    # Simulated execution lag to mimic resource utilization
                    time.sleep(1.0)
                    handler(payload)
                    cls._update_job_status(job_id, "completed")
                    queue_metrics["total_completed"] += 1
                    logger.info(f"Job {job_id} [{job_type}] completed successfully.")
                else:
                    raise ValueError(f"No registered handler for job type: {job_type}")
            except Exception as e:
                cls._update_job_status(job_id, "failed", error=str(e))
                queue_metrics["total_failed"] += 1
                logger.error(f"Job {job_id} failed: {str(e)}")

    # Specific Job Handlers
    @staticmethod
    def _handle_email_job(payload: Dict[str, Any]):
        """Runs the actual SMTP send logic in a background worker thread"""
        from app.services.email import EmailService
        email_type = payload.get("email_type")
        if email_type == "assignment":
            EmailService.send_assignment_email_sync(
                username=payload.get("username"),
                task_id=payload.get("task_id"),
                task_type=payload.get("task_type"),
                recipient_email=payload.get("recipient_email"),
                role=payload.get("role", "annotator")
            )
        elif email_type == "qa_review":
            EmailService.send_qa_review_email_sync(
                submitter_username=payload.get("submitter_username"),
                reviewer_username=payload.get("reviewer_username"),
                recipient_email=payload.get("recipient_email"),
                task_id=payload.get("task_id"),
                task_type=payload.get("task_type"),
                task_data=payload.get("task_data"),
                label=payload.get("label"),
                confidence=payload.get("confidence"),
                approved=payload.get("approved"),
                comments=payload.get("comments")
            )
        elif email_type == "qa_submission":
            EmailService.send_qa_submission_email_sync(
                annotator_username=payload.get("annotator_username"),
                task_id=payload.get("task_id"),
                task_type=payload.get("task_type"),
                recipient_email=payload.get("recipient_email"),
                annotator_email=payload.get("annotator_email")
            )

    @staticmethod
    def _handle_bulk_import_job(payload: Dict[str, Any]):
        """Simulates heavy CSV import bulk processing"""
        task_count = payload.get("task_count", 0)
        logger.info(f"Asynchronously processed bulk import for {task_count} tasks.")

    @staticmethod
    def _handle_ml_train_job(payload: Dict[str, Any]):
        """Simulates ML Model retraining background thread execution"""
        annotations_count = payload.get("annotations_count", 0)
        logger.info(f"Asynchronously triggered ML model re-training using {annotations_count} annotations.")
