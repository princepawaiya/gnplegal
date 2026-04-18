from datetime import date, datetime, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models.matter import Matter
from app.models.client import Client
from app.models.forum import Forum, State
from app.models.user import User
from app.services.auth import get_current_user

router = APIRouter(tags=["GNP Admin Dashboard"])


# ================= HELPERS =================

def to_float(val):
    if val is None:
        return 0.0
    if isinstance(val, Decimal):
        return float(val)
    return float(val)


def require_permission(user: User):
    perms = getattr(user, "permission_map", {}) or {}
    if not (perms.get("*") or perms.get("matters:view")):
        raise HTTPException(status_code=403, detail="Permission denied")


def base_query(db: Session):
    return db.query(Matter).filter(
        Matter.is_deleted.is_(False),
        Matter.is_active.is_(True),
    )


def status_normalized():
    return func.lower(func.trim(func.coalesce(Matter.current_status, "")))


# ================= DASHBOARD =================

@router.get("/dashboard")
def admin_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user)

    query = base_query(db)

    total = query.count()

    pending = query.filter(status_normalized() == "pending").count()

    disposed = query.filter(
        status_normalized().in_(["disposed", "dismissed", "allowed"])
    ).count()

    total_claim = to_float(
        query.with_entities(func.sum(Matter.claim_amount)).scalar()
    )

    pending_exposure = to_float(
        query.filter(status_normalized() == "pending")
        .with_entities(func.sum(Matter.claim_amount))
        .scalar()
    )

    today = date.today()

    hearings_today = query.filter(Matter.ndoh == today).count()

    upcoming = query.filter(
        Matter.ndoh > today,
        Matter.ndoh <= today + timedelta(days=7)
    ).count()

    overdue = query.filter(
        Matter.ndoh < today,
        status_normalized() == "pending"
    ).count()

    # ================= DISTRIBUTIONS =================

    status_dist = query.with_entities(
        Matter.current_status,
        func.count(Matter.id)
    ).group_by(Matter.current_status).all()

    client_dist = query.join(Client).with_entities(
        Client.legal_name,
        func.count(Matter.id)
    ).group_by(Client.legal_name).all()

    state_dist = query.join(Forum).join(State).with_entities(
        State.name,
        func.count(Matter.id)
    ).group_by(State.name).all()

    # ================= RECENT =================

    recent = query.order_by(Matter.updated_at.desc()).limit(10).all()

    return {
        "summary": {
            "total": total,
            "pending": pending,
            "disposed": disposed,
            "total_claim": total_claim,
            "pending_exposure": pending_exposure,
            "hearings_today": hearings_today,
            "upcoming": upcoming,
            "overdue": overdue,
        },
        "status_distribution": status_dist,
        "client_distribution": client_dist,
        "state_distribution": state_dist,
        "recent": [
            {
                "id": m.id,
                "name": m.matter_name,
                "status": m.current_status,
                "ndoh": m.ndoh,
            }
            for m in recent
        ]
    }