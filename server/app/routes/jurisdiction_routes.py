from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.forum import State, District, Forum

router = APIRouter(prefix="/jurisdiction", tags=["Jurisdiction"])


# ---------------- STATES ----------------

@router.get("/states")
def list_states(db: Session = Depends(get_db)):
    states = db.query(State).order_by(State.name).all()
    return [{"id": s.id, "name": s.name} for s in states]


@router.post("/states/create")
def create_state(payload: dict, db: Session = Depends(get_db)):
    name = payload.get("name")

    if not name:
        raise HTTPException(status_code=400, detail="State name required")

    existing = db.query(State).filter(State.name.ilike(name)).first()
    if existing:
        return {"id": existing.id, "name": existing.name}

    state = State(name=name)
    db.add(state)
    db.commit()
    db.refresh(state)

    return {"id": state.id, "name": state.name}


# ---------------- DISTRICTS ----------------

@router.get("/districts/{state_id}")
def list_districts(state_id: int, db: Session = Depends(get_db)):
    districts = (
        db.query(District)
        .filter(District.state_id == state_id)
        .order_by(District.name)
        .all()
    )

    return [{"id": d.id, "name": d.name} for d in districts]


@router.post("/districts/create")
def create_district(payload: dict, db: Session = Depends(get_db)):
    name = payload.get("name")
    state_id = payload.get("state_id")

    if not name or not state_id:
        raise HTTPException(status_code=400, detail="Missing fields")

    existing = (
        db.query(District)
        .filter(District.name.ilike(name), District.state_id == state_id)
        .first()
    )

    if existing:
        return {"id": existing.id, "name": existing.name}

    district = District(name=name, state_id=state_id)
    db.add(district)
    db.commit()
    db.refresh(district)

    return {"id": district.id, "name": district.name}


# ---------------- JURISDICTION SUGGEST ----------------

@router.post("/suggest")
def suggest_jurisdiction(payload: dict, db: Session = Depends(get_db)):
    claim_amount = payload.get("claim_amount")
    state_id = payload.get("state_id")
    district_id = payload.get("district_id")

    # ---------------- VALIDATION ----------------
    if not claim_amount:
        return {"message": "Enter claim amount"}

    try:
        claim_amount = float(claim_amount)
    except:
        raise HTTPException(status_code=400, detail="Invalid claim amount")

    # ---------------- CPA 2019 LOGIC ----------------
    if claim_amount <= 5000000:
        forum_type_id = 1  # DCDRC
        forum_type_code = "DCDRC"

    elif claim_amount <= 20000000:
        forum_type_id = 2  # SCDRC
        forum_type_code = "SCDRC"

    else:
        forum_type_id = 3  # NCDRC
        forum_type_code = "NCDRC"

    query = db.query(Forum).filter(Forum.forum_type_id == forum_type_id)

    # ---------------- DCDRC ----------------
    if forum_type_id == 1:
        if not district_id:
            return {
                "forum_type_id": forum_type_id,
                "forum_type_code": forum_type_code,
                "message": "Select district to identify correct DCDRC"
            }

        query = query.filter(Forum.district_id == district_id)

    # ---------------- SCDRC ----------------
    elif forum_type_id == 2:
        if not state_id:
            return {
                "forum_type_id": forum_type_id,
                "forum_type_code": forum_type_code,
                "message": "Select state to identify correct SCDRC"
            }

        query = query.filter(Forum.state_id == state_id)

    # ---------------- NCDRC ----------------
    # no filter needed

    forum = query.first()

    # ---------------- RESPONSE ----------------
    return {
        "forum_type_id": forum_type_id,
        "forum_id": forum.id if forum else None,
        "forum_name": forum.name if forum else None,
        "forum_type_code": forum_type_code,
    }