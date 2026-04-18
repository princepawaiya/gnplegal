from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Form
from sqlalchemy.orm import Session
from io import BytesIO
import pandas as pd
import uuid
import json

from difflib import get_close_matches
from app.database import get_db
from app.models.user import User
from app.models.client import Client
from app.models.matter import Matter
from app.models.forum import Forum, State, District
from app.services.auth import get_current_user
from fastapi import Body
from app.routes.matter_routes import generate_internal_case_no

router = APIRouter(tags=["Imports"])


# ================= HELPERS =================

def suggest_match(value, options):
    matches = get_close_matches(value, options, n=1, cutoff=0.6)
    return matches[0] if matches else None


def parse_date(value):
    if not value:
        return None
    try:
        return pd.to_datetime(value).date()
    except:
        return None


def normalize(text):
    return str(text or "").strip().lower()


# 🔥 AUTO COLUMN MAPPING
AUTO_MAP = {
    "client": ["client"],
    "matter_name": ["matter"],
    "case_no": ["case"],
    "forum_name": ["forum"],
    "state": ["state"],
    "district": ["district"],
    "claim_amount": ["claim"],
    "current_status": ["status"],
    "assigned_lawyer": ["lawyer", "counsel"],
}


def auto_map_columns(columns):
    mapping = {}

    for col in columns:
        lower = col.lower()

        for field, aliases in AUTO_MAP.items():
            if any(alias in lower for alias in aliases):
                mapping[field] = col

    return mapping


def normalize_name(name):
    return "".join(
        str(name).lower().replace(" ", "").replace(".", "").replace(",", "")
    )


def get_or_create_client(db, name):
    all_clients = db.query(Client).all()
    input_norm = normalize_name(name)

    # 1. EXACT NORMALIZED MATCH (STRICT)
    for c in all_clients:
        if normalize_name(c.legal_name) == input_norm:
            return c

    # 2. FUZZY MATCH (BUT DO NOT AUTO-CREATE)
    names = [c.legal_name for c in all_clients]
    match = suggest_match(name, names)

    if match:
        # 🔥 IMPORTANT: RETURN MATCH, DO NOT CREATE
        return db.query(Client).filter(Client.legal_name == match).first()

    # 3. ONLY CREATE IF NO MATCH AT ALL
    client = Client(legal_name=name)
    db.add(client)
    db.commit()
    db.refresh(client)
    return client


def get_or_create_state(db, name):
    state = db.query(State).filter(State.name.ilike(name)).first()
    if state:
        return state

    state = State(name=name)
    db.add(state)
    db.commit()
    db.refresh(state)
    return state


def get_or_create_district(db, name, state_id):
    district = db.query(District).filter(
        District.name.ilike(name),
        District.state_id == state_id
    ).first()

    if district:
        return district

    district = District(name=name, state_id=state_id)
    db.add(district)
    db.commit()
    db.refresh(district)
    return district


def map_forum_type(text):
    text = normalize(text)

    if "district" in text:
        return 1
    if "state" in text:
        return 2
    if "national" in text:
        return 3

    return 1  # fallback safe


def get_or_create_forum(db, forum_name, district_id, forum_type_id):
    forum = db.query(Forum).filter(
        Forum.name.ilike(forum_name)
    ).first()

    if forum:
        return forum

    forum = Forum(
        name=forum_name,
        district_id=district_id,
        forum_type_id=forum_type_id
    )
    db.add(forum)
    db.commit()
    db.refresh(forum)
    return forum


def get_lawyer_by_name(db, name):
    if not name:
        return None

    return db.query(User).filter(
        User.full_name.ilike(f"%{name.strip()}%"),
        User.role == "lawyer"
    ).first()


# ================= PREVIEW =================

@router.post("/matters/preview")
async def preview_import_matters(
    file: UploadFile = File(...),
    mapping: str = Form("{}"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    contents = await file.read()
    df = pd.read_excel(BytesIO(contents))

    mapping = json.loads(mapping or "{}")

    # 🔥 AUTO MAP
    if not mapping:
        mapping = auto_map_columns(df.columns)

    clients = [c.legal_name for c in db.query(Client).all()]
    forums = [f.name for f in db.query(Forum).all()]

    preview_rows = []

    for idx, row in df.iterrows():
        issues = []
        suggestions = row.get("_suggestions", {})

        client_name = suggestions.get("client") or str(row.get(mapping.get("client"), "")).strip()
        forum_name = suggestions.get("forum_name") or str(row.get(mapping.get("forum_name"), "")).strip()
        case_no = str(row.get(mapping.get("case_no", ""), "")).strip()

        # CLIENT
        normalized_clients = {normalize_name(c): c for c in clients}
        input_client_norm = normalize_name(client_name)

        if client_name:
            if input_client_norm in normalized_clients:
                corrected_name = normalized_clients[input_client_norm]
                if corrected_name != client_name:
                    issues.append("Client name mismatch")
                    suggestions["client"] = corrected_name
            else:
                suggestion = suggest_match(client_name, clients)
                issues.append("Client not found")
                suggestions["client"] = suggestion or f"Create '{client_name}'"

        # FORUM
        if forum_name and forum_name not in forums:
            suggestion = suggest_match(forum_name, forums)
            issues.append("Forum not found")
            suggestions["forum_name"] = suggestion or f"Create '{forum_name}'"

        # DUPLICATE
        if client_name and case_no:
            client = db.query(Client).filter(
                Client.legal_name.ilike(client_name)
            ).first()

            if client:
                existing = db.query(Matter).filter(
                    Matter.client_id == client.id,
                    Matter.case_no == case_no
                ).first()

                if existing:
                    issues.append("Duplicate case")

        preview_rows.append({
            "row_number": idx + 2,
            "data": row.fillna("").to_dict(),
            "issues": issues,
            "suggestions": suggestions,
            "status": "valid" if not issues else "warning"
        })

    return {
        "ok": True,
        "columns": list(df.columns),
        "mapping": mapping,
        "rows": preview_rows
    }


# ================= IMPORT =================

@router.post("/matters")
async def import_matters(
    payload: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = payload.get("rows", [])
    mapping = payload.get("mapping", {})

    if not rows:
        raise HTTPException(status_code=400, detail="No rows received")

    created = 0
    skipped = 0
    errors = []

    for idx, row in enumerate(rows):
        try:
            client_name = str(row.get(mapping.get("client"), "")).strip()
            forum_name = str(row.get(mapping.get("forum_name"), "")).strip()
            state_name = str(row.get(mapping.get("state"), "")).strip()
            district_name = str(row.get(mapping.get("district"), "")).strip()
            case_no = str(row.get(mapping.get("case_no"), "")).strip()

            if not client_name or not forum_name:
                raise Exception("Client / Forum missing")

            client = get_or_create_client(db, client_name)
            state = get_or_create_state(db, state_name) if state_name else None

            district = (
                get_or_create_district(db, district_name, state.id)
                if district_name and state
                else None
            )

            forum_type_id = map_forum_type(forum_name)

            forum = get_or_create_forum(
                db,
                forum_name,
                district.id if district else None,
                forum_type_id
            )

            existing = db.query(Matter).filter(
                Matter.client_id == client.id,
                Matter.case_no == case_no
            ).first()

            if existing:
                skipped += 1
                errors.append(
                    f"Row {idx + 2}: Duplicate case_no '{case_no}' for client '{client_name}'"
                )
                continue

            lawyer = get_lawyer_by_name(
                db,
                row.get(mapping.get("assigned_lawyer"))
            )

            internal_case_no = generate_internal_case_no(db, client)

            def safe_float(value):
                try:
                    if value in (None, "", " ", "NA", "nan", "-"):
                        return 0.0
                    return float(value)
                except Exception:
                    return 0.0

            matter_name = str(row.get(mapping.get("matter_name"), "")).strip()
            if not matter_name:
                raise Exception("Matter name missing")

            matter = Matter(
                internal_case_no=internal_case_no,
                client_id=client.id,
                forum_id=forum.id,
                matter_name=matter_name,
                case_no=case_no,
                claim_amount=safe_float(row.get(mapping.get("claim_amount"))),
                current_status=row.get(mapping.get("current_status")) or "Pending",
                created_by=current_user.id,
                gnp_lawyer_id=lawyer.id if lawyer else None,
                is_active=True,
                is_deleted=False,
            )

            db.add(matter)
            db.flush()
            created += 1

        except Exception as e:
            errors.append(f"Row {idx + 2}: {str(e)}")

    db.commit()

    return {
        "ok": True,
        "created": created,
        "skipped_duplicates": skipped,
        "errors": errors[:20],
    }