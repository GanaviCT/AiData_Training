from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.auth import PermissionChecker
from app.models.user import User
from app.services.backup import BackupService, BACKUP_DIR
from app.services.audit import AuditService
from pydantic import BaseModel
import os
import shutil

router = APIRouter(prefix="/admin/backups", tags=["Backups"])

class RestoreLocalRequest(BaseModel):
    filename: str

@router.get("", response_model=list)
def get_backups(
    current_user: User = Depends(PermissionChecker("system:backup"))
):
    """
    Lists all available database backups (Admin only).
    """
    return BackupService.get_backups_list()

@router.post("/export")
def trigger_export(
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("system:backup"))
):
    """
    Triggers a manual database backup (Admin only).
    """
    try:
        zip_path = BackupService.export_backup(db)
        filename = os.path.basename(zip_path)
        
        AuditService.log_action(
            user_id=current_user.id,
            username=current_user.username,
            action="BACKUP_EXPORT",
            resource_type="system",
            details={"filename": filename}
        )
        return {
            "message": "Backup generated successfully.",
            "filename": filename
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate backup: {str(e)}"
        )

@router.get("/download/{filename}")
def download_backup(
    filename: str,
    current_user: User = Depends(PermissionChecker("system:backup"))
):
    """
    Downloads a specific backup zip file (Admin only).
    """
    filepath = os.path.join(BACKUP_DIR, filename)
    real_path = os.path.abspath(filepath)
    if not real_path.startswith(BACKUP_DIR) or not os.path.exists(filepath):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Backup file not found."
        )
    return FileResponse(filepath, media_type="application/zip", filename=filename)

@router.post("/restore-local")
def restore_local_backup(
    req: RestoreLocalRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("system:backup"))
):
    """
    Restores the database state from a local backup file (Admin only).
    """
    filepath = os.path.join(BACKUP_DIR, req.filename)
    real_path = os.path.abspath(filepath)
    if not real_path.startswith(BACKUP_DIR) or not os.path.exists(filepath):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Backup file not found."
        )
        
    try:
        BackupService.restore_backup(db, filepath)
        
        AuditService.log_action(
            user_id=current_user.id,
            username=current_user.username,
            action="BACKUP_RESTORE",
            resource_type="system",
            details={"filename": req.filename, "source": "local"}
        )
        return {"message": "Database and audit logs restored successfully."}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Restore failed: {str(e)}"
        )

@router.post("/restore")
def upload_and_restore_backup(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(PermissionChecker("system:backup"))
):
    """
    Uploads a backup zip file and restores the database (Admin only).
    """
    BackupService.ensure_backup_dir()
    temp_path = os.path.join(BACKUP_DIR, f"temp_upload_{file.filename}")
    
    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        BackupService.restore_backup(db, temp_path)
        
        AuditService.log_action(
            user_id=current_user.id,
            username=current_user.username,
            action="BACKUP_RESTORE",
            resource_type="system",
            details={"filename": file.filename, "source": "upload"}
        )
        return {"message": "Database restored successfully from uploaded file."}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Restore failed: {str(e)}"
        )
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)
