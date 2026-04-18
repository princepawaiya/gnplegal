from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models.matter import Matter
from app.models.user import User
from app.services.auth import get_current_user
from app.services.legal_workflow_engine import build_case_snapshot

router = APIRouter(tags=["GNP Counsel"])


# ================= ROLE NORMALIZER =================
def normalize_role(role: str):
    return (role or "").strip().lower().replace("_", " ")


# ================= PERMISSION =================
def require_permission(user: User, permission: str):
    perms = getattr(user, "permission_map", {}) or {}

    role = normalize_role(user.role)

    # ✅ allow admin + gnp counsel
    if role in ["admin", "gnp counsel", "lawyer"]:
        return

    if perms.get("*") or perms.get(permission):
        return

    raise HTTPException(status_code=403, detail="Permission denied")


# ================= BASE QUERY =================
def get_base_query(db: Session, current_user: User):
    role = normalize_role(current_user.role)

    query = db.query(Matter).filter(
        Matter.is_deleted.is_(False),
        Matter.is_active.is_(True),
    )

    print("🔍 USER:", current_user.id, "| ROLE:", role)

    if role == "client":
        query = query.filter(Matter.client_id == current_user.client_id)

    elif role in ["lawyer", "gnp counsel"]:
        query = query.filter(Matter.gnp_lawyer_id == current_user.id)

    return query


# ================= CASE LIST (MAIN FIX) =================
@router.get("/cases")
def get_gnp_counsel_cases(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    role = (current_user.role or "").lower().strip()

    query = db.query(Matter).filter(
        Matter.is_deleted == False,
        Matter.is_active == True,
    )

    # ✅ FILTER FOR GNP COUNSEL
    if role in ["lawyer", "gnp counsel"]:
        query = query.filter(Matter.gnp_lawyer_id == current_user.id)

    matters = query.order_by(Matter.updated_at.desc()).all()

    return {
        "data": [
            build_case_snapshot(m)
            for m in matters
        ]
    }


# ================= SUMMARY =================
@router.get("/summary")
def get_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "matters:view")

    query = get_base_query(db, current_user)

    total = query.count()

    active = query.filter(
        Matter.is_disposed == 0
    ).count()

    disposed = query.filter(
        Matter.is_disposed == 1
    ).count()

    return {
        "data": {
            "total": total,
            "active": active,
            "disposed": disposed,
        }
    }


# ================= TODAY =================
@router.get("/today")
def get_today(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "matters:view")

    today = datetime.utcnow().date()
    query = get_base_query(db, current_user)

    hearings_today = query.filter(Matter.ndoh == today).count()

    overdue = query.filter(
        Matter.ndoh.isnot(None),
        Matter.ndoh < today,
        Matter.is_disposed == 0
    ).count()

    upcoming = query.filter(
        Matter.ndoh.isnot(None),
        Matter.ndoh > today
    ).count()

    return {
        "data": {
            "hearings_today": hearings_today,
            "overdue": overdue,
            "upcoming": upcoming,
        }
    }


# ================= ACTIVITY =================
@router.get("/activity")
def get_activity(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "matters:view")

    query = get_base_query(db, current_user)

    recent = (
        query
        .order_by(Matter.updated_at.desc())
        .limit(10)
        .all()
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

# ================= COUNSEL SUMMARY =================
@router.get("/counsel-summary")
def get_counsel_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "matters:view")

    lawyers = db.query(User).filter(
        func.lower(func.trim(User.role)).in_(["lawyer", "gnp counsel"])
    ).all()

    result = []

    for l in lawyers:
        base = db.query(Matter).filter(
            Matter.is_deleted.is_(False),
            Matter.is_active.is_(True),
            Matter.gnp_lawyer_id == l.id,
        )

        total = base.count()

        active = base.filter(Matter.is_disposed == 0).count()

        disposed = base.filter(Matter.is_disposed == 1).count()

        upcoming = base.filter(Matter.ndoh.isnot(None)).count()

        result.append({
            "id": l.id,
            "name": l.full_name,
            "total": total,
            "active": active,
            "disposed": disposed,
            "upcoming": upcoming,
        })

    return {"data": result}

@router.get("/execution-panel")
def get_execution_panel(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "matters:view")

    cases = get_base_query(db, current_user).all()
    snapshots = [build_case_snapshot(m) for m in cases]

    today = datetime.utcnow().date()

    urgent = sum(1 for s in snapshots if s.get("priority") == "HIGH")

    today_hearings = len([
        s for s in snapshots
        if s.get("next_date") == today
    ])

    drafts_pending = len([
        s for s in snapshots
        if "Draft" in s.get("next_action", "")
    ])

    filings_pending = len([
        s for s in snapshots
        if "File" in s.get("next_action", "")
    ])

    return {
        "data": {
            "urgent": urgent,
            "today_hearings": today_hearings,
            "drafts_pending": drafts_pending,
            "filings_pending": filings_pending,
        }
    }

@router.get("/priority-cases")
def get_priority_cases(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "matters:view")

    query = get_base_query(db, current_user)

    cases = (
        query
        .filter(Matter.ndoh.isnot(None))
        .order_by(Matter.ndoh.asc())
        .limit(5)
        .all()
    )

    return {
        "data": [
            build_case_snapshot(m)
            for m in cases
        ]
    }

@router.get("/performance-score")
def get_performance_score(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "matters:view")

    today = datetime.utcnow().date()

    query = get_base_query(db, current_user)

    total = query.count()

    if total == 0:
        return {"score": 0}

    on_time = query.filter(
        Matter.ndoh.isnot(None),
        Matter.ndoh >= today
    ).count()

    overdue = query.filter(
        Matter.ndoh.isnot(None),
        Matter.ndoh < today,
        Matter.is_disposed == 0
    ).count()

    disposed = query.filter(
        Matter.is_disposed == 1
    ).count()

    # 🔥 SIMPLE SCORE FORMULA
    score = int(
        (on_time * 40 + disposed * 40 - overdue * 20) / total
    )

    return {
        "score": max(score, 0)
    }

@router.get("/alerts")
def get_alerts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "matters:view")

    cases = get_base_query(db, current_user).all()

    alerts = []

    for m in cases:
        s = build_case_snapshot(m)

        flags = s.get("flags", [])
        action = s.get("next_action", "")
        case_no = s.get("case_no", "-")

        if "HEARING_SOON" in flags and "Reply" in action:
            alerts.append({
                "type": "HEARING_PREP",
                "case_no": case_no,
                "message": "Reply likely required before upcoming hearing"
            })

        if "NO_NEXT_DATE" in flags:
            alerts.append({
                "type": "MISSING_DATE",
                "case_no": case_no,
                "message": "No next date updated"
            })

        if "STALE_7_DAYS" in flags:
            alerts.append({
                "type": "STALE",
                "case_no": case_no,
                "message": "Case inactive for 7+ days"
            })

    return {
        "data": alerts[:10]
    }