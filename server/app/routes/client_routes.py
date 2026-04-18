import os
import re
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.client import Client
from app.models.client_spoc import ClientSPOC
from app.models.user import User
from app.services.auth import get_current_user

router = APIRouter(tags=["Clients"])


def require_permission(user: User, permission: str):
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")

    perms = getattr(user, "permission_map", {}) or {}

    if perms.get("*"):
        return

    if not perms.get(permission):
        raise HTTPException(status_code=403, detail="Permission denied")


class SPOCIn(BaseModel):
    spoc_name: str
    email: Optional[str] = None
    phone: Optional[str] = None


class ClientCreate(BaseModel):
    name: str
    spocs: List[SPOCIn] = []


class ClientUpdate(BaseModel):
    name: str
    spocs: List[SPOCIn] = []


@router.post("/create")
def create_client(
    payload: ClientCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "clients:create")

    existing = db.query(Client).filter(
        func.lower(Client.legal_name) == payload.name.lower()
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Client already exists")

    client = Client(legal_name=payload.name)
    db.add(client)

    try:
        db.commit()
        db.refresh(client)
    except Exception:
        db.rollback()
        raise

    base_path = "storage"
    safe_name = re.sub(r"[^A-Za-z0-9_]", "", payload.name.replace(" ", "_"))
    client_folder = os.path.join(base_path, safe_name)
    os.makedirs(client_folder, exist_ok=True)

    for index, spoc in enumerate(payload.spocs):
        db.add(
            ClientSPOC(
                client_id=client.id,
                name=spoc.spoc_name,
                email=spoc.email,
                mobile=spoc.phone,
                is_primary=(index == 0),
            )
        )

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise

    return {"message": "Client created successfully", "id": client.id}


@router.get("/list")
def list_clients(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "clients:view")

    clients = (
        db.query(Client)
        .options(joinedload(Client.spocs))
        .order_by(Client.id.desc())
        .all()
    )

    return [
        {
            "id": c.id,
            "legal_name": c.legal_name,
            "name": c.legal_name,
            "spocs": [
                {
                    "spoc_name": s.name,
                    "email": s.email,
                    "phone": s.mobile,
                    "is_primary": s.is_primary,
                    "is_active": s.is_active,
                }
                for s in c.spocs
            ],
        }
        for c in clients
    ]


@router.get("/{client_id}")
def get_client(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "clients:view")

    client = (
        db.query(Client)
        .options(joinedload(Client.spocs))
        .filter(Client.id == client_id)
        .first()
    )

    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    return {
        "id": client.id,
        "legal_name": client.legal_name,
        "name": client.legal_name,
        "client_type": client.client_type,
        "registered_address": client.registered_address,
        "corporate_address": client.corporate_address,
        "billing_address": client.billing_address,
        "pan": client.pan,
        "contact_name": client.contact_name,
        "designation": client.designation,
        "accounts_name": client.accounts_name,
        "accounts_email": client.accounts_email,
        "accounts_mobile": client.accounts_mobile,
        "reference": client.reference,
        "spocs": [
            {
                "name": s.name,
                "email": s.email,
                "mobile": s.mobile,
                "is_primary": s.is_primary,
                "is_active": s.is_active,
            }
            for s in client.spocs
        ],
    }


@router.put("/{client_id}/update")
def update_client(
    client_id: int,
    payload: ClientUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "clients:edit")

    client = db.query(Client).filter(Client.id == client_id).first()

    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    client.legal_name = payload.name

    db.query(ClientSPOC).filter(ClientSPOC.client_id == client_id).delete()

    for index, spoc in enumerate(payload.spocs):
        db.add(
            ClientSPOC(
                client_id=client_id,
                name=spoc.spoc_name,
                email=spoc.email,
                mobile=spoc.phone,
                is_primary=(index == 0),
            )
        )

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise

    return {"message": "Client updated successfully"}


@router.delete("/{client_id}/delete")
def delete_client(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "clients:delete")

    client = db.query(Client).filter(Client.id == client_id).first()

    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    from app.models.matter import Matter

    existing = db.query(Matter).filter(Matter.client_id == client_id).first()

    if existing:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete client with active matters",
        )

    try:
        db.delete(client)
        db.commit()
    except Exception:
        db.rollback()
        raise

    return {"message": "Client deleted successfully"}


@router.get("/{client_id}/matters")
def get_client_matters(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "matters:view")

    from app.models.matter import Matter

    matters = (
        db.query(Matter)
        .filter(Matter.client_id == client_id)
        .order_by(Matter.id.desc())
        .all()
    )

    return [
        {
            "id": m.id,
            "matter_name": m.matter_name,
            "case_no": m.case_no,
            "current_status": m.current_status,
            "ndoh": m.ndoh,
            "ldoh": m.ldoh,
            "claim_amount": m.claim_amount,
            "is_disposed": m.is_disposed,
        }
        for m in matters
    ]

@router.get("/{client_id}/spocs")
def get_client_spocs(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    spocs = db.query(ClientSPOC).filter(ClientSPOC.client_id == client_id).all()

    return [
        {
            "id": s.id,
            "name": s.name,
            "email": s.email,
        }
        for s in spocs
    ]