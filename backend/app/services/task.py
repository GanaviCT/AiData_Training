from fastapi import Depends
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.repositories.task import TaskRepository
from app.models.task import Task
from app.schemas.task import TaskCreate, TaskUpdate

class TaskService:
    def __init__(self, db: Session = Depends(get_db)):
        self.db = db
        self.task_repo = TaskRepository(db)

    def create_task(self, task_in: TaskCreate) -> Task:
        task = self.task_repo.create(task_in)
        if task.assigned_to_id:
            from app.repositories.user import UserRepository
            from app.services.email import EmailService
            user_repo = UserRepository(self.db)
            user = user_repo.get_by_id(task.assigned_to_id)
            if user:
                recipient = task_in.assignee_email or user.email or f"{user.username}@example.com"
                EmailService.send_assignment_email(user.username, task.id, task.type, recipient, user.role)
                if task_in.assignee_email and user.email != task_in.assignee_email:
                    user.email = task_in.assignee_email
                    self.db.commit()
        return task

    def get_task(self, task_id: int) -> Optional[Task]:
        return self.task_repo.get_by_id(task_id)

    def list_tasks(
        self,
        status: Optional[str] = None,
        task_type: Optional[str] = None,
        assigned_to_id: Optional[int] = None,
        priority: Optional[str] = None
    ) -> List[Task]:
        return self.task_repo.list_tasks(
            status=status,
            task_type=task_type,
            assigned_to_id=assigned_to_id,
            priority=priority
        )

    def update_task(self, task_id: int, update_in: TaskUpdate) -> Optional[Task]:
        db_task = self.task_repo.get_by_id(task_id)
        if not db_task:
            return None
        
        old_assignee_id = db_task.assigned_to_id
        updated_task = self.task_repo.update(db_task, update_in)
        
        if updated_task.assigned_to_id and updated_task.assigned_to_id != old_assignee_id:
            from app.repositories.user import UserRepository
            from app.services.email import EmailService
            user_repo = UserRepository(self.db)
            user = user_repo.get_by_id(updated_task.assigned_to_id)
            if user:
                recipient = update_in.assignee_email or user.email or f"{user.username}@example.com"
                EmailService.send_assignment_email(user.username, updated_task.id, updated_task.type, recipient, user.role)
                if update_in.assignee_email and user.email != update_in.assignee_email:
                    user.email = update_in.assignee_email
                    self.db.commit()
                
        return updated_task

    def get_next_task(self) -> Optional[Task]:
        return self.task_repo.get_next_pending()
