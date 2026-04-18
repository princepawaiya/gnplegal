from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.hearing_stage import HearingStage
from app.models.matter import Matter
from app.models.user import User
from app.services.auth import get_current_user

router = APIRouter(tags=["Hearings"])


def require_permission(user: User, permission: str):
    perms = getattr(user, "permission_map", {}) or {}

    if perms.get("*") or perms.get(permission):
        return True

    raise HTTPException(status_code=403, detail="Permission denied")


def parse_date(value) -> Optional[datetime.date]:
    if value in (None, "", "null"):
        return None

    if hasattr(value, "year") and hasattr(value, "month") and hasattr(value, "day"):
        return value

    try:
        return datetime.strptime(str(value)[:10], "%Y-%m-%d").date()
    except Exception:
        return None


@router.get("/history/{matter_id}")
def get_hearing_history(
    matter_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "matters:view")

    rows = (
        db.query(HearingStage)
        .filter(HearingStage.matter_id == matter_id)
        .order_by(HearingStage.created_at.desc(), HearingStage.id.desc())
        .all()
    )

    return [
        {
            "id": h.id,
            "old_ndoh": h.old_ndoh,
            "new_ndoh": h.new_ndoh,
            "comment": h.comment,
            "created_at": h.created_at,
            "is_edited": bool(h.is_edited),
        }
        for h in rows
    ]


@router.patch("/update-ndoh/{matter_id}")
def update_ndoh(
    matter_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "matters:edit")

    matter = db.query(Matter).filter(Matter.id == matter_id).first()
    if not matter:
        raise HTTPException(status_code=404, detail="Matter not found")

    new_ndoh = parse_date(payload.get("new_ndoh"))
    comment = (payload.get("comment") or "").strip()
    user_id = payload.get("user_id")

    if not new_ndoh:
        raise HTTPException(status_code=400, detail="new_ndoh is required")

    if not comment:
        raise HTTPException(status_code=400, detail="comment is required")

    old_ndoh = matter.ndoh
    old_ldoh = matter.ldoh

    matter.ldoh = old_ndoh
    matter.ndoh = new_ndoh

    hearing = HearingStage(
        matter_id=matter.id,
        old_ndoh=old_ndoh,
        new_ndoh=new_ndoh,
        comment=comment,
        user_id=user_id,
        is_edited=False,
        hearing_date=old_ndoh,
        next_hearing_date=new_ndoh,
        remarks=comment,
    )

    db.add(hearing)

    try:
        db.commit()
        db.refresh(hearing)
    except Exception:
        db.rollback()
        raise

    return {
        "message": "Hearing updated successfully",
        "old_ndoh": old_ndoh,
        "new_ndoh": new_ndoh,
        "ldoh": matter.ldoh,
    }


@router.put("/edit-last-ndoh/{matter_id}")
def edit_last_ndoh(
    matter_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "matters:edit")

    new_ndoh = parse_date(payload.get("new_ndoh"))
    comment = (payload.get("comment") or "").strip()

    if not new_ndoh:
        raise HTTPException(status_code=400, detail="new_ndoh and comment required")

    if not comment:
        raise HTTPException(status_code=400, detail="new_ndoh and comment required")

    matter = db.query(Matter).filter(Matter.id == matter_id).first()
    if not matter:
        raise HTTPException(status_code=404, detail="Matter not found")

    last = (
        db.query(HearingStage)
        .filter(HearingStage.matter_id == matter_id)
        .order_by(HearingStage.created_at.desc(), HearingStage.id.desc())
        .first()
    )

    if not last:
        raise HTTPException(status_code=404, detail="No hearing history found")

    last.new_ndoh = new_ndoh
    last.comment = comment
    last.is_edited = True
    last.next_hearing_date = new_ndoh
    last.remarks = comment

    matter.ndoh = new_ndoh

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise

    return {"message": "Last hearing updated"}


@router.put("/undo-last-hearing/{matter_id}")
def undo_last_hearing(
    matter_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "matters:edit")

    matter = db.query(Matter).filter(Matter.id == matter_id).first()
    if not matter:
        raise HTTPException(status_code=404, detail="Matter not found")

    last = (
        db.query(HearingStage)
        .filter(HearingStage.matter_id == matter_id)
        .order_by(HearingStage.created_at.desc(), HearingStage.id.desc())
        .first()
    )

    if not last:
        raise HTTPException(status_code=404, detail="No history found")

    matter.ndoh = last.old_ndoh
    matter.ldoh = None

    db.delete(last)

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise

    return {"message": "Last hearing undone"}