from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models.matter import Matter
from app.models.user import User
from app.services.auth import get_current_user
from app.models.client import Client
from app.models.local_counsel import LocalCounsel
from app.models.invoice import Invoice
from app.services.task_engine import generate_auto_tasks

router = APIRouter(tags=["Dashboard"])


# ================= ROLE NORMALIZER =================
def normalize_role(role: str):
    return (role or "").strip().lower().replace("_", " ")


# ================= PERMISSION =================
def require_permission(user: User, permission: str):
    role = normalize_role(user.role)

    # ✅ allow admin + gnp counsel
    if role in ["admin", "gnp counsel"]:
        return

    perms = getattr(user, "permission_map", {}) or {}

    if perms.get("*") or perms.get(permission):
        return

    raise HTTPException(status_code=403, detail="Permission denied")


# ================= BASE QUERY =================
def get_role_filtered_query(db: Session, current_user: User):
    role = normalize_role(current_user.role)

    query = db.query(Matter).filter(
        Matter.is_deleted.is_(False),
        Matter.is_active.is_(True),
    )

    print("🔍 FILTER USER ID:", current_user.id)
    print("🔍 FILTER ROLE:", role)

    if role == "client":
        query = query.filter(Matter.client_id == current_user.client_id)

    elif role in ["lawyer", "gnp counsel"]:
        query = query.filter(Matter.gnp_lawyer_id == current_user.id)

    return query


# ================= TODAY =================
@router.get("/today")
def gnp_counsel_today(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "matters:view")

    # 🔥 AUTO TASK ENGINE
    try:
        generate_auto_tasks(db, current_user.id)
    except Exception as e:
        print("TASK ENGINE ERROR:", e)

    today = datetime.utcnow().date()
    role = normalize_role(current_user.role)

    if role == "admin":
        query = db.query(Matter).filter(
            Matter.is_deleted.is_(False),
            Matter.is_active.is_(True),
        )
    else:
        query = get_role_filtered_query(db, current_user)

    hearings_today = query.filter(Matter.ndoh == today).count()

    overdue = query.filter(
        Matter.ndoh.isnot(None),
        Matter.ndoh < today,
        Matter.is_disposed == 0,
    ).count()

    upcoming = query.filter(
        Matter.ndoh.isnot(None),
        Matter.ndoh > today,
    ).count()

    return {
        "data": {
            "hearings_today": hearings_today,
            "overdue": overdue,
            "upcoming": upcoming,
        }
    }


# ================= CASES =================
@router.get("/cases")
def gnp_counsel_cases(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "matters:view")

    role = normalize_role(current_user.role)

    print("👤 USER ID:", current_user.id)
    print("👤 ROLE:", role)

    if role == "admin":
        query = db.query(Matter).filter(
            Matter.is_deleted.is_(False),
            Matter.is_active.is_(True),
        )
    else:
        query = get_role_filtered_query(db, current_user)

    total = query.count()

    active = query.filter(
        Matter.is_disposed == 0
    ).count()

    disposed = query.filter(
        Matter.is_disposed == 1
    ).count()

    print("📊 TOTAL FILTERED:", total)

    return {
        "data": {
            "total": total,
            "active": active,
            "disposed": disposed,
        }
    }


# ================= ACTIVITY =================
@router.get("/activity")
def gnp_counsel_activity(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "matters:view")

    role = normalize_role(current_user.role)

    if role == "admin":
        query = db.query(Matter).filter(
            Matter.is_deleted.is_(False),
            Matter.is_active.is_(True),
        )
    else:
        query = get_role_filtered_query(db, current_user)

    recent = (
        query.order_by(Matter.updated_at.desc()).limit(10).all()
    )

    return {
        "data": [
            {
                "id": m.id,
                "matter_name": m.matter_name,
                "status": m.current_status,
                "updated_at": m.updated_at,
            }
            for m in recent
        ]
    }


# ================= ADMIN OVERVIEW =================
@router.get("/admin-overview")
def admin_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "dashboard:view")

    role = normalize_role(current_user.role)

    if role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    base_query = db.query(Matter).filter(
        Matter.is_deleted.is_(False),
        Matter.is_active.is_(True),
    )

    total_matters = base_query.count()

    active_matters = base_query.filter(
        Matter.is_disposed == 0
    ).count()

    disposed_matters = base_query.filter(
        Matter.is_disposed == 1
    ).count()

    total_clients = db.query(func.count(Client.id)).scalar()
    total_counsels = db.query(func.count(LocalCounsel.id)).scalar()

    today = datetime.utcnow().date()

    hearings_today = base_query.filter(Matter.ndoh == today).count()

    overdue = base_query.filter(
        Matter.ndoh.isnot(None),
        Matter.ndoh < today,
        Matter.is_disposed == 0
    ).count()

    return {
        "data": {
            "matters": {
                "total": total_matters,
                "active": active_matters,
                "disposed": disposed_matters,
            },
            "clients": total_clients,
            "counsels": total_counsels,
            "revenue": 0,
            "hearings": {
                "today": hearings_today,
                "overdue": overdue,
            }
        }
    }


# ================= CONTROL TOWER =================
@router.get("/control-tower")
def control_tower(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "dashboard:view")

    role = normalize_role(current_user.role)

    if role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    today = datetime.utcnow().date()

    base_query = db.query(Matter).filter(
        Matter.is_deleted.is_(False),
        Matter.is_active.is_(True),
    )

    missed_hearings = base_query.filter(
        Matter.ndoh.isnot(None),
        Matter.ndoh < today,
        Matter.is_disposed == 0
    ).count()

    stale_cases = base_query.filter(
        Matter.updated_at < (datetime.utcnow() - timedelta(days=7))
    ).count()

    no_ndoh = base_query.filter(
        Matter.ndoh.is_(None),
        Matter.is_disposed == 0
    ).count()

    no_counsel = base_query.filter(
        Matter.gnp_lawyer_id.is_(None)
    ).count()

    return {
        "data": {
            "alerts": {
                "missed_hearings": missed_hearings,
                "stale_cases": stale_cases,
            },
            "actions": {
                "no_next_date": no_ndoh,
                "no_counsel": no_counsel,
            },

            # ✅ ADD THIS BLOCK HERE
            "performance": {
                "top_lawyers": [],
                "slow_lawyers": []
            }
        }
    }