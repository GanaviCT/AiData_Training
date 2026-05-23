from sqlalchemy.orm import Session
from typing import List, Optional
from app.repositories.base import BaseRepository
from app.models.task import Task
from app.schemas.task import TaskCreate, TaskUpdate

class TaskRepository(BaseRepository):
    def get_by_id(self, task_id: int) -> Task:
        return self.db.query(Task).filter(Task.id == task_id).first()

    def list_tasks(
        self,
        status: Optional[str] = None,
        task_type: Optional[str] = None,
        assigned_to_id: Optional[int] = None,
        priority: Optional[str] = None
    ) -> List[Task]:
        query = self.db.query(Task)
        if status:
            query = query.filter(Task.status == status)
        if task_type:
            query = query.filter(Task.type == task_type)
        if assigned_to_id:
            query = query.filter(Task.assigned_to_id == assigned_to_id)
        if priority:
            query = query.filter(Task.priority == priority)
        return query.order_by(Task.id).all()

    def create(self, task_in: TaskCreate) -> Task:
        # PPU Simulated Cost Calculation
        base_cost = 0.50 if task_in.type == "text" else (2.50 if task_in.type == "video" else 1.50)
        
        # Priority multiplier
        priority_multiplier = 1.0
        if task_in.priority == "medium":
            priority_multiplier = 1.25
        elif task_in.priority == "high":
            priority_multiplier = 1.50
            
        # Complexity factor based on length
        complexity_bonus = 0.0
        if task_in.type == "text":
            complexity_bonus = min(0.50, len(task_in.data) / 1000.0)
        elif task_in.type == "video":
            # Add length-based simulated complexity for URLs
            complexity_bonus = min(1.00, len(task_in.data) / 100.0)
            
        calculated_cost = round((base_cost * priority_multiplier) + complexity_bonus, 2)

        data_content = task_in.data
        if task_in.redact_pii and task_in.type == "text":
            import re
            # Redact emails
            data_content = re.sub(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+', '[REDACTED_EMAIL]', data_content)
            # Redact phone numbers
            data_content = re.sub(r'(?:\+?\d{1,3}[ -]?)?\(?\d{3}\)?[ -]?\d{3}[ -]?\d{4}', '[REDACTED_PHONE]', data_content)
            # Redact SSNs
            data_content = re.sub(r'\b\d{3}-\d{2}-\d{4}\b', '[REDACTED_SSN]', data_content)

        db_task = Task(
            type=task_in.type,
            data=data_content,
            priority=task_in.priority or "medium",
            status=task_in.status or "pending",
            assigned_to_id=task_in.assigned_to_id,
            cost=calculated_cost,
            import_source=task_in.import_source or "single",
            lineage_history=task_in.lineage_history
        )
        self.db.add(db_task)
        self.db.commit()
        self.db.refresh(db_task)
        return db_task

    def update(self, db_task: Task, update_in: TaskUpdate) -> Task:
        update_data = update_in.model_dump(exclude_unset=True)
        update_data.pop("assignee_email", None)
        for field, value in update_data.items():
            setattr(db_task, field, value)
        self.db.commit()
        self.db.refresh(db_task)
        return db_task

    def get_next_pending(self) -> Optional[Task]:
        from sqlalchemy import case
        priority_order = case(
            (Task.priority == "high", 1),
            (Task.priority == "medium", 2),
            (Task.priority == "low", 3),
            else_=4
        )
        return self.db.query(Task).filter(Task.status == "pending").order_by(priority_order, Task.id).first()
