from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.client import Client
from app.models.user import User
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/clients", tags=["API Clients"])


@router.get("")
def api_list_clients(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = db.query(Client).order_by(Client.legal_name.asc()).all()
    return [{"id": r.id, "name": r.legal_name} for r in rows]