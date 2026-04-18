from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.forum import Forum, ForumType, State, District
from app.models.user import User
from app.services.auth import get_current_user

router = APIRouter(tags=["Forums"])


def require_permission(user: User, permission: str):
    perms = getattr(user, "permission_map", {}) or {}
    if perms.get("*") or perms.get(permission):
        return
    raise HTTPException(status_code=403, detail="Permission denied")


# =====================================================
# STATE
# Frontend expects: /forums/state/list
# =====================================================

@router.get("/state/list")
def list_states(
    db: Session = Depends(get_db),
):
    rows = db.query(State).order_by(State.name.asc()).all()
    return [{"id": s.id, "name": s.name} for s in rows]


@router.post("/state/create")
def create_state(
    name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "clients:create")

    name = (name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="State name required")

    existing = db.query(State).filter(State.name == name).first()
    if existing:
        return {"id": existing.id, "name": existing.name}

    state = State(name=name)
    db.add(state)
    db.commit()
    db.refresh(state)

    # 🚀 AUTO CREATE SCDRC
    forum_name = f"State Consumer Disputes Redressal Commission, {state.name}"

    existing_forum = (
        db.query(Forum)
        .filter(
            Forum.name == forum_name,
            Forum.state_id == state.id,
            Forum.forum_type_id == 2,
        )
        .first()
    )

    if not existing_forum:
        forum = Forum(
            name=forum_name,
            forum_type_id=2,
            state_id=state.id,
        )
        db.add(forum)
        db.commit()

    return {"id": state.id, "name": state.name}

# =====================================================
# DISTRICT
# Frontend expects: /forums/district/list?state_id=...
# =====================================================

@router.get("/district/list")
def list_districts(
    state_id: int = Query(...),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(District)
        .filter(District.state_id == state_id)
        .order_by(District.name.asc())
        .all()
    )
    return [{"id": d.id, "name": d.name, "state_id": d.state_id} for d in rows]


@router.post("/district/create")
def create_district(
    name: str,
    state_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "clients:create")

    name = (name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="District name required")

    state = db.query(State).filter(State.id == state_id).first()
    if not state:
        raise HTTPException(status_code=404, detail="State not found")

    existing = (
        db.query(District)
        .filter(District.name == name, District.state_id == state_id)
        .first()
    )
    if existing:
        return {"id": existing.id, "name": existing.name, "state_id": existing.state_id}

    district = District(name=name, state_id=state_id)
    db.add(district)
    db.commit()
    db.refresh(district)

    # Auto-create DCDRC forum
    forum_name = f"District Consumer Disputes Redressal Commission, {district.name}, {state.name}"
    forum_exists = (
        db.query(Forum)
        .filter(
            Forum.name == forum_name,
            Forum.forum_type_id == 1,
            Forum.state_id == state.id,
            Forum.district_id == district.id,
        )
        .first()
    )

    if not forum_exists:
        forum = Forum(
            name=forum_name,
            forum_type_id=1,
            state_id=state.id,
            district_id=district.id,
        )
        db.add(forum)
        db.commit()

    return {"id": district.id, "name": district.name, "state_id": district.state_id}


# =====================================================
# FORUM TYPES
# Frontend expects: /forums/forum-type/list
# =====================================================

@router.get("/forum-type/list")
def list_forum_types(
    db: Session = Depends(get_db),
):
    rows = db.query(ForumType).order_by(ForumType.id.asc()).all()
    return [{"id": r.id, "name": r.name} for r in rows]


# =====================================================
# CREATE FORUM
# Frontend expects: /forums/create
# =====================================================

@router.post("/create")
def create_forum(
    name: str,
    forum_type_id: int,
    state_id: int | None = None,
    district_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "clients:create")

    name = (name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Forum name required")

    forum_type = db.query(ForumType).filter(ForumType.id == forum_type_id).first()
    if not forum_type:
        raise HTTPException(status_code=404, detail="Forum type not found")

    if state_id is not None:
        state = db.query(State).filter(State.id == state_id).first()
        if not state:
            raise HTTPException(status_code=404, detail="State not found")

    if district_id is not None:
        district = db.query(District).filter(District.id == district_id).first()
        if not district:
            raise HTTPException(status_code=404, detail="District not found")

    existing = (
        db.query(Forum)
        .filter(
            Forum.name == name,
            Forum.forum_type_id == forum_type_id,
            Forum.state_id == state_id,
            Forum.district_id == district_id,
        )
        .first()
    )
    if existing:
        return {
            "id": existing.id,
            "name": existing.name,
            "forum_type_id": existing.forum_type_id,
            "state_id": existing.state_id,
            "district_id": existing.district_id,
        }

    forum = Forum(
        name=name,
        forum_type_id=forum_type_id,
        state_id=state_id,
        district_id=district_id,
    )
    db.add(forum)
    db.commit()
    db.refresh(forum)

    return {
        "id": forum.id,
        "name": forum.name,
        "forum_type_id": forum.forum_type_id,
        "state_id": forum.state_id,
        "district_id": forum.district_id,
    }


# =====================================================
# LIST FORUMS
# Frontend expects: /forums/list
# =====================================================

@router.get("/list")
def list_forums(
    forum_type_id: int | None = None,
    state_id: int | None = None,
    district_id: int | None = None,
    db: Session = Depends(get_db),
):
    query = db.query(Forum)

    if forum_type_id is not None:
        query = query.filter(Forum.forum_type_id == forum_type_id)

    if state_id is not None:
        query = query.filter(Forum.state_id == state_id)

    if district_id is not None:
        query = query.filter(Forum.district_id == district_id)

    rows = query.order_by(Forum.name.asc()).all()

    # 🚀 AUTO CREATE IF NOT FOUND
    if not rows and forum_type_id:

        state = db.query(State).filter(State.id == state_id).first() if state_id else None
        district = db.query(District).filter(District.id == district_id).first() if district_id else None
        forum_type = db.query(ForumType).filter(ForumType.id == forum_type_id).first()

        forum = None
        name = None

        # =========================
        # EXISTING (DO NOT TOUCH)
        # =========================

        if forum_type_id == 1 and state and district:
            name = f"District Consumer Disputes Redressal Commission, {district.name}, {state.name}"

        elif forum_type_id == 2 and state:
            name = f"State Consumer Disputes Redressal Commission, {state.name}"

        elif forum_type_id == 3:
            delhi = db.query(State).filter(State.name == "Delhi").first()
            name = "National Consumer Disputes Redressal Commission, New Delhi"

            forum = Forum(
                name=name,
                forum_type_id=3,
                state_id=delhi.id if delhi else None,
            )

        # =========================
        # 🆕 DISTRICT COURT
        # =========================
        elif forum_type and forum_type.name.lower() == "district court" and state and district:
            name = f"District Court, {district.name}, {state.name}"

        # =========================
        # 🆕 HIGH COURT
        # =========================
        elif forum_type and forum_type.name.lower() == "high court" and state:
            name = f"High Court of {state.name}"

        # =========================
        # 🆕 SUPREME COURT
        # =========================
        elif forum_type and forum_type.name.lower() == "supreme court":
            name = "Supreme Court of India, New Delhi"

        # =========================
        # 🆕 DRT
        # =========================
        elif forum_type and forum_type.name.lower() == "drt" and state:
            name = f"Debt Recovery Tribunal, {state.name}"

        # =========================
        # 🆕 DRAT
        # =========================
        elif forum_type and forum_type.name.lower() == "drat":
            name = "Debt Recovery Appellate Tribunal"

        # =========================
        # 🆕 GENERIC (POLICE / NOTICE / ETC)
        # =========================
        elif forum_type:
            name = forum_type.name

        # =========================
        # CREATE
        # =========================
        if name and not forum:
            forum = Forum(
                name=name,
                forum_type_id=forum_type_id,
                state_id=state.id if state else None,
                district_id=district.id if district else None,
            )

        if forum:
            existing = (
                db.query(Forum)
                .filter(
                    Forum.name == forum.name,
                    Forum.forum_type_id == forum.forum_type_id,
                    Forum.state_id == forum.state_id,
                    Forum.district_id == forum.district_id,
                )
                .first()
            )

            if not existing:
                db.add(forum)
                db.commit()
                db.refresh(forum)
                rows = [forum]
            else:
                rows = [existing]

    return [
        {
            "id": f.id,
            "name": f.name,
            "forum_type_id": f.forum_type_id,
            "state_id": f.state_id,
            "district_id": f.district_id,
        }
        for f in rows
    ]