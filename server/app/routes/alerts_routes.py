from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.matter import Matter
from app.models.user import User
from app.services.auth import get_current_user
from app.services.auth import require_permission

router = APIRouter(tags=["Alerts"])


@router.get("/list")
def list_alerts(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("alerts:view")),
):
    today = datetime.utcnow().date()
    next_week = today + timedelta(days=7)

    matters = db.query(Matter).all()

    alerts = []

    for m in matters:
        if m.ndoh and m.ndoh < today and not m.is_disposed:
            alerts.append({
                "type": "overdue_hearing",
                "matter_id": m.id,
                "matter_name": m.matter_name,
                "message": "Matter hearing date is overdue",
                "date": m.ndoh,
            })

        if m.ndoh and today <= m.ndoh <= next_week:
            alerts.append({
                "type": "upcoming_hearing",
                "matter_id": m.id,
                "matter_name": m.matter_name,
                "message": "Upcoming hearing in next 7 days",
                "date": m.ndoh,
            })

    return alerts

@router.get("/matters")
def alert_matters(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("alerts:view")),
):

    from app.models.matter import Matter
    from datetime import datetime, timedelta

    today = datetime.utcnow().date()
    next_7_days = today + timedelta(days=7)

    matters = db.query(Matter).filter(
        Matter.ndoh != None,
        Matter.ndoh <= next_7_days
    ).all()

    result = []

    for m in matters:
        result.append({
            "id": m.id,
            "matter_name": m.matter_name,
            "case_no": m.case_no,
            "ndoh": m.ndoh,
            "status": m.current_status,
        })

    return result