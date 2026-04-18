from datetime import datetime
import os
import shutil
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Body
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.knowledge_document import KnowledgeDocument
from app.models.user import User
from app.services.auth import get_current_user

router = APIRouter(tags=["Knowledge"])

KNOWLEDGE_DIR = os.path.join("storage", "knowledge")
os.makedirs(KNOWLEDGE_DIR, exist_ok=True)


def normalize_category(value: str | None) -> str | None:
    if value is None:
        return None
    return str(value).strip().lower()


def clean(value):
    return (value or "").strip()


def serialize_knowledge(row: KnowledgeDocument):
    return {
        "id": row.id,
        "title": row.title,
        "category": row.doc_type,
        "doc_type": row.doc_type,
        "category_name": clean(row.category_name),
        "sub_category_name": clean(row.sub_category_name),
        "file_url": f"/{row.file_path}" if row.file_path else None,
        "file_path": row.file_path,
        "created_at": row.created_at,
    }


# ================= LIST =================
@router.get("")
def list_knowledge(
    category: str | None = None,
    doc_type: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    selected_type = normalize_category(category) or normalize_category(doc_type)

    query = db.query(KnowledgeDocument)

    if selected_type:
        query = query.filter(KnowledgeDocument.doc_type == selected_type)

    rows = query.order_by(
        KnowledgeDocument.category_name.asc().nullslast(),
        KnowledgeDocument.sub_category_name.asc().nullslast(),
        KnowledgeDocument.created_at.desc(),
    ).all()

    # ✅ DO NOT DROP BARE ACTS
    if selected_type == "bare_act":
        clean_rows = rows
    else:
        clean_rows = [
            r for r in rows
            if r.category_name or r.sub_category_name or r.file_path
        ]

    return {"data": [serialize_knowledge(r) for r in clean_rows]}


# ================= CREATE DOCUMENT =================
@router.post("/create")
def create_knowledge(
    payload: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    title = clean(payload.get("title"))
    category = normalize_category(payload.get("category"))

    if not title:
        raise HTTPException(status_code=400, detail="Title required")

    if category not in {"bare_act", "judgement", "template"}:
        raise HTTPException(status_code=400, detail="Invalid category")

    row = KnowledgeDocument(
        title=title,
        doc_type=category,
        file_path=None,
        created_at=datetime.utcnow(),
    )

    db.add(row)
    db.commit()
    db.refresh(row)

    return {"message": "Created", "data": serialize_knowledge(row)}


# ================= CREATE CATEGORY =================
@router.post("/create-category")
def create_category(
    payload: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    category = normalize_category(payload.get("category"))
    category_name = clean(payload.get("category_name"))

    if not category_name:
        raise HTTPException(status_code=400, detail="Category name required")

    exists = db.query(KnowledgeDocument).filter(
        KnowledgeDocument.doc_type == category,
        KnowledgeDocument.category_name == category_name,
        KnowledgeDocument.sub_category_name.is_(None)
    ).first()

    if exists:
        return {"message": "Category already exists"}

    row = KnowledgeDocument(
        title=category_name,
        doc_type=category,
        category_name=category_name,
        created_at=datetime.utcnow(),
    )

    db.add(row)
    db.commit()

    return {"message": "Category created"}


# ================= CREATE SUB CATEGORY =================
@router.post("/create-sub-category")
def create_sub_category(
    payload: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    category = normalize_category(payload.get("category"))
    category_name = clean(payload.get("category_name"))
    sub_category_name = clean(payload.get("sub_category_name"))

    if not category_name or not sub_category_name:
        raise HTTPException(status_code=400, detail="Invalid input")

    exists = db.query(KnowledgeDocument).filter(
        KnowledgeDocument.doc_type == category,
        KnowledgeDocument.category_name == category_name,
        KnowledgeDocument.sub_category_name == sub_category_name
    ).first()

    if exists:
        return {"message": "Sub-category already exists"}

    row = KnowledgeDocument(
        title=sub_category_name,
        doc_type=category,
        category_name=category_name,
        sub_category_name=sub_category_name,
        created_at=datetime.utcnow(),
    )

    db.add(row)
    db.commit()

    return {"message": "Sub-category created"}


# ================= UPLOAD =================
@router.post("/upload")
def upload_knowledge(
    title: str = Form(...),
    category: str = Form(...),
    file: UploadFile = File(...),
    category_name: str | None = Form(None),
    sub_category_name: str | None = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    clean_title = clean(title)
    clean_category = normalize_category(category)
    category_name = clean(category_name)
    sub_category_name = clean(sub_category_name)

    if not clean_title:
        raise HTTPException(status_code=400, detail="Title required")

    if clean_category not in {"bare_act", "judgement", "template"}:
        raise HTTPException(status_code=400, detail="Invalid category")

    ext = os.path.splitext(file.filename or "")[1]
    filename = f"{uuid.uuid4().hex}{ext}"

    abs_path = os.path.join(KNOWLEDGE_DIR, filename)
    rel_path = os.path.join("storage", "knowledge", filename).replace("\\", "/")

    with open(abs_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # 🔍 find existing row by title + category
    existing = db.query(KnowledgeDocument).filter(
        KnowledgeDocument.title == clean_title,
        KnowledgeDocument.doc_type == clean_category,
    ).first()

    if existing:
        existing.file_path = rel_path
        existing.category_name = category_name or existing.category_name
        existing.sub_category_name = sub_category_name or existing.sub_category_name
        db.commit()
        db.refresh(existing)
        return {"message": "Updated", "data": serialize_knowledge(existing)}

    # else create new
    row = KnowledgeDocument(
        title=clean_title,
        doc_type=clean_category,
        category_name=category_name,
        sub_category_name=sub_category_name,
        file_path=rel_path,
        created_at=datetime.utcnow(),
    )

    db.add(row)
    db.commit()
    db.refresh(row)

    return {"message": "Uploaded", "data": serialize_knowledge(row)}


# ================= DELETE =================
@router.delete("/{item_id}")
def delete_knowledge(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = db.query(KnowledgeDocument).filter(KnowledgeDocument.id == item_id).first()

    if not row:
        raise HTTPException(status_code=404, detail="Not found")

    if row.file_path:
        abs_path = row.file_path
        if not os.path.isabs(abs_path):
            abs_path = os.path.join(os.getcwd(), row.file_path)

        if os.path.exists(abs_path):
            os.remove(abs_path)

    db.delete(row)
    db.commit()

    return {"message": "Deleted"}