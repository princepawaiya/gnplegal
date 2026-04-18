from datetime import datetime
from sqlalchemy.orm import Session
from app.models.matter_event import MatterEvent


def log_event(
    db: Session,
    matter_id: int,
    event_type: str,
    user_id: int | None = None,
    title: str | None = None,
    description: str | None = None,
    old_value: str | None = None,
    new_value: str | None = None,
    event_date: datetime | None = None,
):
    event = MatterEvent(
        matter_id=matter_id,
        user_id=user_id,
        event_type=event_type,
        title=title,
        description=description,
        old_value=old_value,
        new_value=new_value,
        event_date=event_date,
    )

    db.add(event)
    db.flush()  # ✅ ensures ID generated without committing

    return event


# ================= OPTIONAL HELPERS (SAFE TO KEEP) =================

def log_status_change(db: Session, matter, new_status: str, user_id: int | None):
    old_status = matter.current_status

    if old_status == new_status:
        return

    log_event(
        db=db,
        matter_id=matter.id,
        user_id=user_id,
        event_type="status_update",
        title="Status Updated",
        description=f"Status changed from {old_status} to {new_status}",
        old_value=old_status,
        new_value=new_status,
    )


def log_stage_change(db: Session, matter, new_stage: str, user_id: int | None):
    old_stage = matter.current_stage

    if old_stage == new_stage:
        return

    log_event(
        db=db,
        matter_id=matter.id,
        user_id=user_id,
        event_type="stage_update",
        title="Stage Updated",
        description=f"Stage changed from {old_stage} to {new_stage}",
        old_value=old_stage,
        new_value=new_stage,
    )


def log_hearing_update(
    db: Session,
    matter,
    new_ldoh=None,
    new_ndoh=None,
    user_id: int | None = None,
):
    changes = []

    if new_ldoh and matter.ldoh != new_ldoh:
        changes.append(f"LDOH: {matter.ldoh} → {new_ldoh}")

    if new_ndoh and matter.ndoh != new_ndoh:
        changes.append(f"NDOH: {matter.ndoh} → {new_ndoh}")

    if not changes:
        return

    log_event(
        db=db,
        matter_id=matter.id,
        user_id=user_id,
        event_type="hearing_update",
        title="Hearing Date Updated",
        description=", ".join(changes),
        event_date=new_ndoh or new_ldoh,
    )


def log_document_upload(
    db: Session,
    matter_id: int,
    document_type: str | None,
    user_id: int | None,
):
    log_event(
        db=db,
        matter_id=matter_id,
        user_id=user_id,
        event_type="document_upload",
        title="Document Uploaded",
        description=f"{document_type or 'Document'} uploaded",
    )


def log_note(
    db: Session,
    matter_id: int,
    note: str,
    user_id: int | None,
):
    log_event(
        db=db,
        matter_id=matter_id,
        user_id=user_id,
        event_type="note",
        title="Note Added",
        description=note,
    )