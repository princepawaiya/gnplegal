from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime

from app.database import get_db
from app.models.matter import Matter
from app.models.user import User
from app.services.auth import get_current_user

router = APIRouter(tags=["GNP Dashboard"])


# ================= PERMISSION =================

def require_permission(user: User, permission: str):
    perms = getattr(user, "permission_map", {}) or {}

    if perms.get("*") or perms.get(permission):
        return

    raise HTTPException(status_code=403, detail="Permission denied")


# ================= COUNSEL SUMMARY =================

@router.get("/counsel-summary")
def get_counsel_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "dashboard:view")

    today = datetime.utcnow().date()

    # 🔥 Get all GNP lawyers
    lawyers = db.query(User).filter(User.role == "lawyer").all()

    result = []

    for lawyer in lawyers:

        matters = db.query(Matter).filter(
            Matter.gnp_lawyer_id == lawyer.id
        ).all()

        total = len(matters)

        pending = len([
            m for m in matters
            if (m.current_status or "").lower() == "pending"
        ])

        closed = len([
            m for m in matters
            if (m.current_status or "").lower() in ["disposed", "allowed", "dismissed"]
        ])

        upcoming = len([
            m for m in matters
            if m.ndoh and m.ndoh >= today
        ])

        missed = len([
            m for m in matters
            if m.ndoh and m.ndoh < today and not m.is_disposed
        ])

        # ================= STAGE BREAKDOWN =================
        stage_map = {}

        for m in matters:
            stage = m.current_stage or "Unknown"
            stage_map[stage] = stage_map.get(stage, 0) + 1

        stage_breakdown = [
            {"stage": k, "count": v}
            for k, v in stage_map.items()
        ]

        result.append({
            "id": lawyer.id,
            "name": lawyer.full_name,
            "total": total,
            "pending": pending,
            "upcoming": upcoming,
            "missed": missed,
            "closed": closed,
            "stage_breakdown": stage_breakdown
        })

    return {
        "data": result
    }


# ================= TODAY =================

@router.get("/today")
def get_today(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "dashboard:view")

    today = datetime.utcnow().date()

    hearings_today = db.query(Matter).filter(
        Matter.ndoh == today
    ).count()

    overdue = db.query(Matter).filter(
        Matter.ndoh.isnot(None),
        Matter.ndoh < today,
        Matter.is_disposed == 0
    ).count()

    return {
        "data": {
            "hearings_today": hearings_today,
            "overdue": overdue,
        }
    }


# ================= CASE LIST =================

@router.get("/cases")
def get_cases(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "matters:view")

    matters = db.query(Matter).order_by(Matter.created_at.desc()).limit(10).all()

    return {
        "data": [
            {
                "id": m.id,
                "matter_name": m.matter_name,
                "status": m.current_status,
            }
            for m in matters
        ]
    }


# ================= ACTIVITY =================

@router.get("/activity")
def get_activity(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "matters:view")

    recent = db.query(Matter).order_by(Matter.updated_at.desc()).limit(10).all()

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