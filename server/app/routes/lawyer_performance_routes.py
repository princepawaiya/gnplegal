from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.matter import Matter
from app.services.auth import get_current_user

router = APIRouter(tags=["Lawyer Performance"])


@router.get("/summary")
def lawyer_performance_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    lawyers = db.query(User).filter(User.role == "lawyer").all()

    data = []
    for lawyer in lawyers:
        total = db.query(Matter).filter(Matter.gnp_lawyer_id == lawyer.id).count()
        disposed = db.query(Matter).filter(
            Matter.gnp_lawyer_id == lawyer.id,
            Matter.is_disposed == 1
        ).count()

        data.append({
            "lawyer_id": lawyer.id,
            "lawyer_name": lawyer.full_name,
            "total_cases": total,
            "disposed_cases": disposed,
        })

    return data