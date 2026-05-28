from fastapi import APIRouter, Depends, Query
from typing import List, Optional
from app.services.auth import AuthService, RoleChecker, PermissionChecker
from app.services.audit import AuditService
from app.models.user import User

router = APIRouter(prefix="/audit", tags=["Audit Logs"])

# Require Admin role permissions for viewing audit logs & analytics
admin_checker = PermissionChecker("system:debug")

@router.get("/logs")
def get_audit_logs(
    limit: int = Query(50, ge=1, le=100),
    skip: int = Query(0, ge=0),
    username: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    current_user: User = Depends(admin_checker)
):
    """
    Get recent audit logs. Supports Lucene-style search query string 'q'.
    """
    return AuditService.get_logs(limit=limit, skip=skip, username=username, action=action, q=q)

@router.get("/analytics")
def get_audit_analytics(
    current_user: User = Depends(admin_checker)
):
    """
    Retrieve log metrics for Kibana-style logs chart visualizations.
    """
    return AuditService.get_analytics()
