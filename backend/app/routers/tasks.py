from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from app.services.task import TaskService
from app.services.auth import AuthService, RoleChecker
from app.schemas.task import TaskCreate, TaskUpdate, TaskOut
from app.models.user import User
from app.services.audit import AuditService
from app.services.cache import CacheService

router = APIRouter(prefix="/tasks", tags=["Tasks"])

# Create single task (Admin only)
@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
def create_task(
    task_in: TaskCreate,
    task_service: TaskService = Depends(),
    current_user: User = Depends(RoleChecker(["admin"]))
):
    import datetime
    if not task_in.lineage_history:
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        task_in.lineage_history = f"Created manually by @{current_user.username} on {timestamp}"
    task = task_service.create_task(task_in)
    
    # Clear caches
    CacheService.clear_pattern("dashboard:*")
    CacheService.clear_pattern("agreement:*")

    AuditService.log_action(
        user_id=current_user.id,
        username=current_user.username,
        action="TASK_CREATE",
        resource_type="task",
        resource_id=task.id,
        details={"type": task.type, "priority": task.priority, "cost": task.cost}
    )
    return task

# Bulk create tasks (Admin only)
@router.post("/bulk", response_model=List[TaskOut], status_code=status.HTTP_201_CREATED)
def bulk_create_tasks(
    tasks_in: List[TaskCreate],
    task_service: TaskService = Depends(),
    current_user: User = Depends(RoleChecker(["admin"]))
):
    import datetime
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    created_tasks = []
    for task_in in tasks_in:
        if not task_in.import_source or task_in.import_source == "single":
            task_in.import_source = "bulk"
        if not task_in.lineage_history:
            task_in.lineage_history = f"Imported via bulk upload by @{current_user.username} on {timestamp}"
        created_tasks.append(task_service.create_task(task_in))
    
    # Clear caches
    CacheService.clear_pattern("dashboard:*")
    CacheService.clear_pattern("agreement:*")

    AuditService.log_action(
        user_id=current_user.id,
        username=current_user.username,
        action="TASK_BULK_IMPORT",
        resource_type="task",
        details={"count": len(created_tasks)}
    )
    return created_tasks

# List tasks (Annotators, Reviewers, Admins can view)
@router.get("", response_model=List[TaskOut])
def list_tasks(
    status: Optional[str] = None,
    type: Optional[str] = None,
    assigned_to_id: Optional[int] = None,
    priority: Optional[str] = None,
    task_service: TaskService = Depends(),
    current_user: User = Depends(AuthService.get_current_user)
):
    return task_service.list_tasks(
        status=status,
        task_type=type,
        assigned_to_id=assigned_to_id,
        priority=priority
    )

# Get next task in queue
@router.get("/queue/next", response_model=TaskOut)
def get_next_task(
    task_service: TaskService = Depends(),
    current_user: User = Depends(AuthService.get_current_user)
):
    task = task_service.get_next_task()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No pending tasks in queue"
        )
    return task

# Get specific task
@router.get("/{id}", response_model=TaskOut)
def get_task(
    id: int,
    task_service: TaskService = Depends(),
    current_user: User = Depends(AuthService.get_current_user)
):
    task = task_service.get_task(id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task with ID {id} not found"
        )
    return task

# Update task (Admin or assignee/annotator self-assigning/updating)
@router.put("/{id}", response_model=TaskOut)
def update_task(
    id: int,
    update_in: TaskUpdate,
    task_service: TaskService = Depends(),
    current_user: User = Depends(AuthService.get_current_user)
):
    # Perform status/assignment checks if needed
    task = task_service.get_task(id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task with ID {id} not found"
        )
    
    # Simple rule: if annotator is self-assigning, we allow it
    # Admin can update anything.
    if current_user.role == "annotator" and update_in.assigned_to_id and update_in.assigned_to_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot assign tasks to other users"
        )
        
    old_assigned_to_id = task.assigned_to_id
    updated_task = task_service.update_task(id, update_in)
    
    action = "TASK_UPDATE"
    if update_in.assigned_to_id and (old_assigned_to_id != update_in.assigned_to_id):
        action = "TASK_ASSIGN"
        
    AuditService.log_action(
        user_id=current_user.id,
        username=current_user.username,
        action=action,
        resource_type="task",
        resource_id=id,
        details={
            "status": updated_task.status,
            "assigned_to_id": updated_task.assigned_to_id
        }
    )
    return updated_task
