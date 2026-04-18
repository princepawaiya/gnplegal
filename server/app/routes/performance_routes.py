from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.matter import Matter
from app.services.auth import get_current_user

router = APIRouter(prefix="/performance", tags=["Performance"])


def require_permission(user: User, permission: str):
    perms = getattr(user, "permission_map", {}) or {}

    if perms.get("*") or perms.get(permission):
        return

    raise HTTPException(status_code=403, detail="Permission denied")


@router.get("/lawyer/{lawyer_id}")
def get_lawyer_performance(
    lawyer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "matters:view")

    lawyer = db.query(User).filter(
        User.id == lawyer_id,
        User.role == "lawyer"
    ).first()

    if not lawyer:
        raise HTTPException(status_code=404, detail="Lawyer not found")

    # Role safety:
    # - admin can view anyone
    # - lawyer can view self
    # - client can view assigned lawyer performance only if that lawyer is linked to one of their matters
    role = (current_user.role or "").strip().lower()

    if role == "lawyer" and current_user.id != lawyer_id:
        raise HTTPException(status_code=403, detail="Access denied")

    if role == "client":
        linked_count = db.query(Matter).filter(
            Matter.client_id == current_user.client_id,
            Matter.gnp_lawyer_id == lawyer_id
        ).count()

        if linked_count == 0:
            raise HTTPException(status_code=403, detail="Access denied")

    matters = db.query(Matter).filter(
        Matter.gnp_lawyer_id == lawyer_id
    ).all()

    total_cases = len(matters)

    disposed_cases = len([
        m for m in matters
        if (m.is_disposed or 0) == 1
    ])

    active_cases = total_cases - disposed_cases

    today = date.today()

    upcoming_cases = len([
        m for m in matters
        if m.ndoh and m.ndoh >= today and (m.is_disposed or 0) == 0
    ])

    overdue_cases = len([
        m for m in matters
        if m.ndoh and m.ndoh < today and (m.is_disposed or 0) == 0
    ])

    favourable_cases = len([
        m for m in matters
        if (m.outcome or "").strip().lower() in {"favour", "settled"}
        or (m.current_status or "").strip().lower() == "allowed"
    ])

    # Average resolution days for disposed matters
    resolution_days = []
    for m in matters:
        if (m.is_disposed or 0) == 1 and m.allocation_date and m.order_date:
            try:
                days = (m.order_date - m.allocation_date).days
                if days >= 0:
                    resolution_days.append(days)
            except Exception:
                pass

    avg_resolution_days = (
        round(sum(resolution_days) / len(resolution_days), 2)
        if resolution_days else 0
    )

    # Activity score:
    # simple weighted score aligned to dashboard display needs
    activity_score = (
        (disposed_cases * 3)
        + (upcoming_cases * 1)
        - (overdue_cases * 2)
    )
    if activity_score < 0:
        activity_score = 0

    # Overall score out of 100
    score = 0

    if total_cases == 0:
        score = 0
    else:
        disposal_rate = (disposed_cases / total_cases) * 100
        favourable_rate = (favourable_cases / total_cases) * 100 if total_cases else 0

        timeliness_score = 100
        if overdue_cases > 0:
            timeliness_score = max(0, 100 - ((overdue_cases / total_cases) * 100))

        resolution_score = 100
        if avg_resolution_days > 0:
            if avg_resolution_days <= 180:
                resolution_score = 100
            elif avg_resolution_days <= 365:
                resolution_score = 80
            elif avg_resolution_days <= 730:
                resolution_score = 60
            else:
                resolution_score = 40

        score = round(
            (disposal_rate * 0.35)
            + (favourable_rate * 0.25)
            + (timeliness_score * 0.20)
            + (resolution_score * 0.20),
            2
        )

    return {
        "lawyer_id": lawyer.id,
        "lawyer_name": lawyer.full_name,
        "total_cases": total_cases,
        "active_cases": active_cases,
        "disposed_cases": disposed_cases,
        "upcoming_cases": upcoming_cases,
        "overdue_cases": overdue_cases,
        "favourable_cases": favourable_cases,
        "avg_resolution_days": avg_resolution_days,
        "activity_score": activity_score,
        "score": score,
    }