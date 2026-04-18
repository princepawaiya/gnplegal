from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.role import Role
from app.models.user import User
from app.services.auth import get_current_user
from app.constants.permissions import PERMISSION_GROUPS


router = APIRouter(tags=["Roles"])


# ================= PERMISSION CHECK =================

def require_permission(user: User, permission: str):
    perms = getattr(user, "permission_map", {}) or {}

    if perms.get("*") or perms.get(permission):
        return

    raise HTTPException(status_code=403, detail="Permission denied")


# ================= LIST ROLES =================

@router.get("/list")
def list_roles(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "roles:view")

    roles = (
        db.query(Role)
        .filter(Role.is_active == True)
        .order_by(Role.name.asc())
        .all()
    )

    return [
        {
            "id": r.id,
            "name": r.name,
            "description": r.description,
            "permissions": r.get_permissions() or [],
        }
        for r in roles
    ]


# ================= ASSIGN ROLE =================

@router.put("/assign")
def assign_role(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "roles:assign")

    user_id = payload.get("user_id")
    role_id = payload.get("role_id")

    if not user_id or not role_id:
        raise HTTPException(
            status_code=400,
            detail="user_id and role_id are required"
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    user.role_id = role.id
    user.role = (role.name or "").strip().lower()

    db.commit()
    db.refresh(user)

    return {
        "message": "Role assigned successfully",
        "user": {
            "id": user.id,
            "role_id": user.role_id,
            "role": user.role,
        }
    }


# ================= PERMISSIONS =================

@router.get("/permissions")
def list_grouped_permissions(
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "roles:view")

    if not PERMISSION_GROUPS or not isinstance(PERMISSION_GROUPS, list):
        return []

    return PERMISSION_GROUPS