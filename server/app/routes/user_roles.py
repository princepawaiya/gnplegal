from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.role import Role
from app.services.auth import get_current_user

router = APIRouter(tags=["User Roles"])


@router.get("/map")
def user_role_map(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    users = db.query(User).all()

    return [
        {
            "user_id": u.id,
            "full_name": u.full_name,
            "email": u.email,
            "role": u.role,
            "role_id": u.role_id,
        }
        for u in users
    ]