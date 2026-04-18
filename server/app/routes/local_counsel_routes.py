from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.local_counsel import LocalCounsel
from app.models.user import User
from app.services.auth import get_current_user

router = APIRouter(tags=["Local Counsels"])


def require_permission(user: User, permission: str):
    perms = getattr(user, "permission_map", {}) or {}
    if perms.get("*") or perms.get(permission):
        return True
    raise HTTPException(status_code=403, detail="Permission denied")


@router.get("/list")
def list_local_counsels(
    state: Optional[str] = None,
    city: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "counsels:view")

    query = db.query(LocalCounsel)

    if state:
        query = query.filter(LocalCounsel.state == state)

    if city:
        query = query.filter(LocalCounsel.city == city)

    counsels = query.order_by(LocalCounsel.name.asc()).all()

    return [
        {
            "id": c.id,
            "name": c.name,
            "email": c.email,
            "phone": c.phone,
            "alternate_phone": getattr(c, "alternate_phone", None),
            "city": c.city,
            "state": c.state,
            "postal_address": getattr(c, "postal_address", None),
            "bar_registration_no": getattr(c, "bar_registration_no", None),
            "pan_no": getattr(c, "pan_no", None),
            "upi_details": getattr(c, "upi_details", None),
            "reference": getattr(c, "reference", None),
            "type": getattr(c, "type", None),
            "is_approved": getattr(c, "is_approved", 0),
        }
        for c in counsels
    ]


@router.get("/by-city")
def list_local_counsels_by_city(
    city: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "counsels:view")

    counsels = (
        db.query(LocalCounsel)
        .filter(LocalCounsel.city == city)
        .order_by(LocalCounsel.name.asc())
        .all()
    )

    return [{"id": c.id, "name": c.name} for c in counsels]


@router.get("/{counsel_id}")
def get_local_counsel(
    counsel_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "counsels:view")

    counsel = db.query(LocalCounsel).filter(LocalCounsel.id == counsel_id).first()
    if not counsel:
        raise HTTPException(status_code=404, detail="Counsel not found")

    return {
        "id": counsel.id,
        "name": counsel.name,
        "email": counsel.email,
        "phone": counsel.phone,
        "alternate_phone": getattr(counsel, "alternate_phone", None),
        "city": counsel.city,
        "state": counsel.state,
        "postal_address": getattr(counsel, "postal_address", None),
        "bar_registration_no": getattr(counsel, "bar_registration_no", None),
        "pan_no": getattr(counsel, "pan_no", None),
        "pan_file_path": getattr(counsel, "pan_file_path", None),
        "bar_certificate_path": getattr(counsel, "bar_certificate_path", None),
        "upi_details": getattr(counsel, "upi_details", None),
        "reference": getattr(counsel, "reference", None),
        "type": getattr(counsel, "type", None),
        "is_approved": getattr(counsel, "is_approved", 0),
    }


@router.post("/create")
def create_local_counsel(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "counsels:create")

    # =============================
    # BASIC FIELDS
    # =============================
    name = (payload.get("name") or "").strip()
    phone = (payload.get("phone") or "").strip()
    city = (payload.get("city") or "").strip()
    state = (payload.get("state") or "").strip() or None
    email = (payload.get("email") or "").strip() or None

    if not name:
        raise HTTPException(status_code=400, detail="name is required")

    if not phone:
        raise HTTPException(status_code=400, detail="phone is required")

    if not city:
        raise HTTPException(status_code=400, detail="city is required")

    # =============================
    # AUTO-FILL STATE FROM MATTER (IF AVAILABLE)
    # =============================
    if not state:
        matter_id = payload.get("matter_id")

        if matter_id:
            from app.models.matter import Matter

            matter = db.query(Matter).filter(Matter.id == matter_id).first()

            if matter and matter.forum and matter.forum.state:
                state = matter.forum.state.name

    # =============================
    # DUPLICATE CHECK
    # =============================
    existing = None

    if email:
        existing = db.query(LocalCounsel).filter(LocalCounsel.email == email).first()

    if not existing:
        existing = (
            db.query(LocalCounsel)
            .filter(
                LocalCounsel.phone == phone,
                LocalCounsel.city == city,
            )
            .first()
        )

    if existing:
        return {
            "message": "Counsel already exists",
            "id": existing.id,
        }

    # =============================
    # CREATE COUNSEL
    # =============================
    counsel = LocalCounsel(
        name=name,
        email=email,
        phone=phone,
        alternate_phone=(payload.get("alternate_phone") or "").strip() or None,
        city=city,
        state=state,
        postal_address=(payload.get("postal_address") or "").strip() or None,
        bar_registration_no=(payload.get("bar_registration_no") or "").strip() or None,
        pan_no=(payload.get("pan_no") or "").strip() or None,
        upi_details=(payload.get("upi_details") or "").strip() or None,
        reference=(payload.get("reference") or "").strip() or None,
        type=(payload.get("type") or "location").strip(),
        is_approved=0,
    )

    db.add(counsel)

    try:
        db.commit()
        db.refresh(counsel)
    except Exception:
        db.rollback()
        raise

    return {
        "message": "Local counsel created successfully",
        "id": counsel.id,
    }


@router.put("/{counsel_id}/update")
def update_local_counsel(
    counsel_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "counsels:create")

    counsel = db.query(LocalCounsel).filter(LocalCounsel.id == counsel_id).first()
    if not counsel:
        raise HTTPException(status_code=404, detail="Counsel not found")

    updatable_fields = [
        "name",
        "email",
        "phone",
        "alternate_phone",
        "city",
        "state",
        "postal_address",
        "bar_registration_no",
        "pan_no",
        "upi_details",
        "reference",
        "type",
    ]

    for field in updatable_fields:
        if field in payload:
            value = payload[field]
            if isinstance(value, str):
                value = value.strip() or None
            setattr(counsel, field, value)

    try:
        db.commit()
        db.refresh(counsel)
    except Exception:
        db.rollback()
        raise

    return {"message": "Local counsel updated successfully"}


@router.put("/{counsel_id}/approve")
def approve_local_counsel(
    counsel_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "counsels:approve")

    counsel = db.query(LocalCounsel).filter(LocalCounsel.id == counsel_id).first()
    if not counsel:
        raise HTTPException(status_code=404, detail="Counsel not found")

    counsel.is_approved = 1

    try:
        db.commit()
        db.refresh(counsel)
    except Exception:
        db.rollback()
        raise

    return {"message": "Counsel approved successfully"}