import os
import shutil
import time
from decimal import Decimal

from datetime import date, datetime
from typing import Any, Optional
from sqlalchemy.orm import contains_eager
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from app.database import SessionLocal
from app.models.client import Client
from app.models.client_invoice import ClientInvoice
from app.models.client_payment import ClientPayment
from app.models.counsel_invoice import CounselInvoice
from app.models.counsel_payment import CounselPayment
from app.models.forum import Forum
from app.models.local_counsel import LocalCounsel, MatterLocalCounsel
from app.models.matter import Matter
from app.models.matter_document import MatterDocument
from app.models.matter_event import MatterEvent
from app.models.user import User
from app.services.auth import get_current_user
from app.services.client_invoice_generator import generate_part1_invoice, generate_part2_invoice
from app.services.matter_event_service import log_event
from app.utils.file_utils import build_file_url, get_relative_path
from fastapi import Body
from sqlalchemy import or_


router = APIRouter(tags=["Matters"])

ALLOWED_EXTENSIONS = {"pdf", "docx", "xlsx", "jpg", "jpeg", "png"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB
FINAL_STATUSES = {"Allowed", "Dismissed", "Disposed", "Settled"}


class AssignCounselRequest(BaseModel):
    counsel_id: int


class AssignGNPCounselRequest(BaseModel):
    counsel_id: int


class StageUpdateRequest(BaseModel):
    stage: str


class StatusUpdateRequest(BaseModel):
    status: str


class LDOHUpdateRequest(BaseModel):
    ldoh: date


class MatterBasicUpdateRequest(BaseModel):
    client_id: Optional[int] = None
    matter_name: Optional[str] = None
    case_no: Optional[str] = None
    dc_sc_no: Optional[str] = None
    forum_id: Optional[int] = None
    claim_amount: Optional[float] = None
    summary: Optional[str] = None
    allegation: Optional[str] = None
    comments: Optional[str] = None
    ndoh: Optional[date] = None
    ldoh: Optional[date] = None
    allocation_date: Optional[date] = None
    reply_filed_date: Optional[date] = None
    pleadings_status: Optional[str] = None
    current_status: Optional[str] = None
    current_stage: Optional[str] = None
    outcome: Optional[str] = None
    client_share: Optional[float] = None
    client_savings: Optional[float] = None
    product_id: Optional[int] = None

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def require_permission(permission: str):
    def checker(current_user: User = Depends(get_current_user)):
        perms = getattr(current_user, "permission_map", {}) or {}

        if perms.get("*") or perms.get(permission):
            return current_user

        raise HTTPException(status_code=403, detail="Permission denied")

    return checker


def normalize_to_date(value: Any) -> Optional[date]:
    if value in (None, "", "null"):
        return None

    if isinstance(value, datetime):
        return value.date()

    if isinstance(value, date):
        return value

    try:
        return datetime.strptime(str(value)[:10], "%Y-%m-%d").date()
    except Exception:
        return None


def get_safe_filename(filename: str) -> str:
    return os.path.basename(filename or "file").replace(" ", "_")


def validate_file(file: UploadFile) -> None:
    if not file.filename or "." not in file.filename:
        raise HTTPException(status_code=400, detail="Invalid file name")

    ext = file.filename.rsplit(".", 1)[-1].lower()

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Invalid file type")

    if file.content_type not in [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "image/jpeg",
        "image/png"
    ]:
        raise HTTPException(status_code=400, detail="Invalid file content")


def validate_file_size(file: UploadFile) -> None:
    file.file.seek(0, os.SEEK_END)
    size = file.file.tell()
    file.file.seek(0)

    if size > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="OOps...File too large, upload file upto 5 mb size")


def ensure_matter_access(matter: Matter, current_user: User) -> None:
    role_name = (getattr(current_user, "role", "") or "").strip().lower()

    if role_name == "client" and getattr(current_user, "client_id", None) != matter.client_id:
        raise HTTPException(status_code=403, detail="Access denied")

    if role_name == "lawyer" and matter.gnp_lawyer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")


def compute_current_stage(matter: Matter) -> Optional[str]:
    if matter.current_status in FINAL_STATUSES:
        return matter.current_status

    if matter.pleadings_status == "Evidence & WA Filed":
        return "Arguments"

    if matter.pleadings_status == "Evidence Filed":
        return "Evidence"

    if matter.pleadings_status == "WA Filed":
        return "Reply Filed"

    if matter.case_no:
        return "Admission"

    return matter.current_stage

def get_folder_name(subfolder: str) -> str:
    mapping = {
        "documents": "Pleadings",
        "orders": "Orders",
        "invoices": "Counsel_Invoices",
        "client_invoices": "Client_Invoices",
        "payments": "Counsel_Payments",
        "client_payments": "Client_Payments",
    }
    return mapping.get(subfolder, subfolder)


def get_matter_root(matter: Matter) -> str:
    client_name = sanitize_name(
        matter.client.legal_name if matter.client else f"client_{matter.client_id}"
    )
    matter_name = sanitize_name(
        matter.matter_name or f"matter_{matter.id}"
    )

    return os.path.join("storage", client_name, matter_name)


def sanitize_name(name: str) -> str:
    import re

    if not name:
        return ""

    name = re.sub(r'[\r\n\t]+', ' ', name)
    name = re.sub(r'\s+', ' ', name)

    return (
        name.strip()
        .replace("/", "_")
        .replace("\\", "_")
        .replace(" ", "_")
        .replace("(", "")
        .replace(")", "")
        .replace(".", "")
    )


def save_uploaded_file(
    matter: Matter,
    subfolder: str,
    file: UploadFile,
    prefix: Optional[str] = None,
) -> str:
    validate_file(file)
    validate_file_size(file)

    # 🔥 FORCE SAFE FETCH
    client_name = sanitize_name(
        getattr(matter.client, "legal_name", None) or f"client_{matter.client_id}"
    )

    matter_name = sanitize_name(
        getattr(matter, "matter_name", None) or f"matter_{matter.id}"
    )

    print("FINAL CLIENT:", client_name)
    print("FINAL MATTER:", matter_name)

    folder = os.path.join(
        "storage",
        client_name,
        matter_name,
        subfolder,
    )

    os.makedirs(folder, exist_ok=True)

    safe_filename = get_safe_filename(file.filename)
    import uuid
    timestamp = f"{int(time.time())}_{uuid.uuid4().hex[:6]}"
    final_name = f"{prefix}_{timestamp}_{safe_filename}" if prefix else f"{timestamp}_{safe_filename}"

    absolute_path = os.path.join(folder, final_name)

    with open(absolute_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return get_relative_path(absolute_path)

def delete_relative_file(relative_path: Optional[str]) -> None:
    if not relative_path:
        return

    normalized = relative_path.replace("\\", "/")
    absolute_path = relative_path if normalized.startswith("storage/") else os.path.join("storage", relative_path)

    try:
        if os.path.exists(absolute_path):
            os.remove(absolute_path)
    except Exception:
        pass


def file_url_or_none(relative_path: Optional[str]) -> Optional[str]:
    return build_file_url(relative_path) if relative_path else None


def safe_log_event(**kwargs) -> None:
    try:
        log_event(**kwargs)
    except Exception:
        pass

def generate_internal_case_no(db: Session, client: Client) -> str:
    name = (client.legal_name or "XXX").strip().upper()
    prefix = "".join([c for c in name if c.isalpha()])[:3]

    if len(prefix) < 3:
        prefix = (prefix + "XXX")[:3]

    last_matter = (
        db.query(Matter)
        .filter(Matter.client_id == client.id, Matter.is_deleted == False)
        .order_by(Matter.id.desc())
        .with_for_update()
        .first()
    )

    if last_matter and last_matter.internal_case_no:
        try:
            last_no = int(last_matter.internal_case_no.split("-")[-1])
        except:
            last_no = 0
    else:
        last_no = 0

    serial = str(last_no + 1).zfill(3)

    return f"GNP-{prefix}-{serial}"

# =====================================================
# 🟢 CREATE MATTER (REQUIRED)
# =====================================================
@router.post("/create")
def create_matter(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("matters:create")),
):
    try:
        # ✅ VALIDATION
        court_mode = (payload.get("court_mode") or "consumer").strip().lower()

        required_fields = ["client_id", "matter_name", "forum_id"]

        for field in required_fields:
            if payload.get(field) in (None, "", []):
                raise HTTPException(status_code=400, detail=f"{field} is required")

        if court_mode not in {"consumer", "court"}:
            raise HTTPException(status_code=400, detail="Invalid court_mode")

        client = db.query(Client).filter(Client.id == payload.get("client_id")).first()
        if not client:
            raise HTTPException(status_code=400, detail="Invalid client")

        forum = db.query(Forum).filter(Forum.id == payload.get("forum_id")).first()
        if not forum:
            raise HTTPException(status_code=400, detail="Invalid forum")

        payload_forum_type_id = payload.get("forum_type_id")
        if payload_forum_type_id and int(payload_forum_type_id) != int(forum.forum_type_id):
            raise HTTPException(status_code=400, detail="Forum type does not match selected forum")

        # ✅ GENERATE INTERNAL CASE NO
        internal_case_no = generate_internal_case_no(db, client)

        # ✅ CREATE MATTER
        matter = Matter(
            created_by=current_user.id,
            internal_case_no=internal_case_no,
            client_id=int(payload.get("client_id")),
            matter_name=payload.get("matter_name"),
            case_no=payload.get("case_no"),
            dc_sc_no=payload.get("dc_sc_no"),
            forum_id=int(payload.get("forum_id")),
            claim_amount=Decimal(str(payload.get("claim_amount"))) if payload.get("claim_amount") not in (None, "") else None,
            summary=payload.get("summary"),
            allegation=payload.get("allegation"),
            comments=payload.get("comments"),
            ndoh=normalize_to_date(payload.get("ndoh")),
            ldoh=normalize_to_date(payload.get("ldoh")),
            allocation_date=normalize_to_date(payload.get("allocation_date")) or date.today(),
            pleadings_status=payload.get("pleadings_status") or "Pending",
            current_status=payload.get("current_status") or "Pending",
            current_stage="Admission",
            product_id=int(payload.get("product_id")) if payload.get("product_id") not in (None, "") else None,
        )

        db.add(matter)
        db.commit()
        db.refresh(matter)

        # ✅ EVENT LOG
        safe_log_event(
            db=db,
            matter_id=matter.id,
            user_id=current_user.id,
            event_type="matter_created",
            title="Matter Created",
            description=matter.matter_name,
        )

        return {
            "message": "Matter created successfully",
            "id": matter.id,
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

# =====================================================
# 🟢 LIST MATTERS (NEW - REQUIRED)
# =====================================================
@router.get("/list")
def list_matters(
    client_id: Optional[int] = None,
    status: Optional[str] = None,
    stage: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    page_size: int = 10,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("matters:view")),
):
    query = (
        db.query(Matter)
        .filter(Matter.is_deleted == False, Matter.is_active == True)
        .options(
            joinedload(Matter.client),        # ✅ CLIENT FIX
            joinedload(Matter.gnp_lawyer),    # ✅ GNP FIX
            joinedload(Matter.forum),         # ✅ SAFE
            joinedload(Matter.local_counsels),  # 🔥 ADD THIS

        )
    )

    # 🔹 FILTERS
    if not page or page < 1:
        page = 1

    page_size = min(page_size, 50)
    if client_id:
        query = query.filter(Matter.client_id == client_id)

    if status:
        query = query.filter(Matter.current_status == status)

    if stage:
        query = query.filter(Matter.current_stage == stage)

    # 🔹 SEARCH (IMPORTANT)
    if search:
        query = query.filter(
            or_(
                Matter.matter_name.ilike(f"%{search}%"),
                Matter.case_no.ilike(f"%{search}%"),
                Matter.internal_case_no.ilike(f"%{search}%")
            )
        )

    total = query.count()

    items = (
        query.order_by(Matter.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    print("TOTAL MATTERS:", total)

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "data": [
            {
                "id": m.id,
                "matter_name": m.matter_name,
                "case_no": m.case_no,

                # ✅ CLIENT
                "client_name": getattr(m.client, "legal_name", None),

                # ✅ STATUS
                "case_status": m.current_status,
                "stage": m.current_stage,

                # ✅ DATES
                "ldoh": m.ldoh,
                "ndoh": m.ndoh,

                # ✅ GNP COUNSEL
                "gnp_counsel": (
                    m.gnp_lawyer.full_name
                    if m.gnp_lawyer else None
                ),

                # ✅ LOCAL COUNSEL (IMPORTANT)
                "local_counsel": ", ".join([c.name for c in m.local_counsels]) if m.local_counsels else None
            }
            for m in items
        ]
    }
# =====================================================
# 🟢 UPCOMING HEARINGS (NEW)
# =====================================================
@router.get("/upcoming-hearings")
def upcoming_hearings(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("matters:view")),
):
    today = date.today()

    rows = (
        db.query(Matter).filter(Matter.is_deleted == False, Matter.is_active == True)
        .outerjoin(MatterLocalCounsel, MatterLocalCounsel.matter_id == Matter.id)
        .outerjoin(LocalCounsel, LocalCounsel.id == MatterLocalCounsel.local_counsel_id)
        .options(
            joinedload(Matter.client),
            joinedload(Matter.forum),
            joinedload(Matter.gnp_lawyer),
        )
        .filter(Matter.ndoh != None)
        .filter(func.date(Matter.ndoh) >= today)
        .order_by(
            Matter.ndoh.asc(),
            Matter.current_stage.asc()
        )
        .limit(20)
        .all()
    )

    result = []

    for m in rows:
        
        result.append({
            "matter_id": m.id,
            "client_name": getattr(m.client, "legal_name", None),
            "matter_name": m.matter_name,
            "forum_name": getattr(m.forum, "name", None),
            "ldoh": m.ldoh,
            "ndoh": m.ndoh,
            "gnp_lawyer_id": m.gnp_lawyer_id,
            "purpose": m.current_stage,
            "stage": m.current_stage,
            "gnp_counsel": getattr(m.gnp_lawyer, "full_name", None),
            "local_counsel": ", ".join([c.name for c in m.local_counsels]) if m.local_counsels else None,
        })

    return result


@router.get("/{matter_id}/documents")
def list_matter_documents(
    matter_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("matters:edit")),
):
    matter = db.query(Matter).filter(Matter.id == matter_id, Matter.is_deleted == False).first()
    if not matter:
        raise HTTPException(status_code=404, detail="Matter not found")

    ensure_matter_access(matter, current_user)

    docs = (
        db.query(MatterDocument)
        .filter(MatterDocument.matter_id == matter_id)
        .order_by(MatterDocument.id.desc())
        .all()
    )

    return [
        {
            "id": d.id,
            "file_name": d.file_name,
            "file_path": d.file_path,
            "file_url": build_file_url(d.file_path),
            "uploaded_at": getattr(d, "uploaded_at", None),
        }
        for d in docs
    ]


@router.post("/{matter_id}/documents")
def upload_matter_document(
    matter_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("matters:edit")),
):
    matter = db.query(Matter).filter(Matter.id == matter_id, Matter.is_deleted == False).first()
    if not matter:
        raise HTTPException(status_code=404, detail="Matter not found")

    ensure_matter_access(matter, current_user)

    relative_path = save_uploaded_file(matter, "Pleadings", file)

    doc = MatterDocument(
        matter_id=matter_id,
        file_name=file.filename,
        file_path=relative_path,
    )
    db.add(doc)

    try:
        db.commit()
        db.refresh(doc)
    except Exception:
        db.rollback()
        raise

    return {
        "message": "Document uploaded successfully",
        "document_id": doc.id,
        "file_url": build_file_url(doc.file_path),
    }


@router.delete("/documents/{document_id}")
def delete_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("matters:edit")),
):
    doc = db.query(MatterDocument).filter(MatterDocument.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    matter = db.query(Matter).filter(Matter.id == doc.matter_id).first()
    if not matter:
        raise HTTPException(status_code=404, detail="Matter not found")

    ensure_matter_access(matter, current_user)

    delete_relative_file(doc.file_path)
    db.delete(doc)

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise

    return {"message": "Document deleted successfully"}


@router.put("/{matter_id}/update-ldoh")
def update_ldoh(
    matter_id: int,
    payload: LDOHUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("matters:edit")),
):
    matter = db.query(Matter).filter(Matter.id == matter_id, Matter.is_deleted == False).first()
    if not matter:
        raise HTTPException(status_code=404, detail="Matter not found")

    ensure_matter_access(matter, current_user)

    old_ldoh = matter.ldoh
    matter.ldoh = normalize_to_date(payload.ldoh)

    try:
        db.commit()
        db.refresh(matter)
    except Exception:
        db.rollback()
        raise

    safe_log_event(
        db=db,
        matter_id=matter.id,
        user_id=current_user.id,
        event_type="ldoh_update",
        title="Last Hearing Updated",
        description=f"{old_ldoh} → {matter.ldoh}",
        old_value=str(old_ldoh) if old_ldoh else None,
        new_value=str(matter.ldoh) if matter.ldoh else None,
    )

    return {"message": "Last date updated successfully", "ldoh": matter.ldoh}


@router.put("/{matter_id}/update-stage")
def update_stage(
    matter_id: int,
    payload: StageUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("matters:edit")),
):
    matter = db.query(Matter).filter(Matter.id == matter_id, Matter.is_deleted == False).first()
    if not matter:
        raise HTTPException(status_code=404, detail="Matter not found")

    ensure_matter_access(matter, current_user)

    old_stage = matter.current_stage
    matter.current_stage = payload.stage

    try:
        db.commit()
        db.refresh(matter)
    except Exception:
        db.rollback()
        raise

    safe_log_event(
        db=db,
        matter_id=matter.id,
        user_id=current_user.id,
        event_type="stage_update",
        title="Stage Updated",
        description=f"{old_stage or '-'} → {payload.stage}",
        old_value=old_stage,
        new_value=payload.stage,
    )

    if (payload.stage or "").strip().lower() == "reply filed":
        try:
            client_invoice = db.query(ClientInvoice).filter(ClientInvoice.matter_id == matter.id).first()
            if client_invoice and not client_invoice.part1_file:
                generate_part1_invoice(db, matter)
        except Exception:
            pass

    return {"message": "Stage updated successfully", "current_stage": matter.current_stage}


@router.put("/{matter_id}/update-status")
def update_matter_status(
    matter_id: int,
    payload: StatusUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("matters:edit")),
):
    matter = db.query(Matter).filter(Matter.id == matter_id, Matter.is_deleted == False).first()
    if not matter:
        raise HTTPException(status_code=404, detail="Matter not found")

    ensure_matter_access(matter, current_user)

    new_status = (payload.status or "").strip()
    if new_status in FINAL_STATUSES:
        raise HTTPException(status_code=400, detail="Final statuses require order upload")

    old_status = matter.current_status
    matter.current_status = new_status
    matter.current_stage = compute_current_stage(matter)

    try:
        db.commit()
        db.refresh(matter)
    except Exception:
        db.rollback()
        raise

    safe_log_event(
        db=db,
        matter_id=matter.id,
        user_id=current_user.id,
        event_type="status_update",
        title="Status Updated",
        description=f"{old_status} → {new_status}",
        old_value=old_status,
        new_value=new_status,
    )

    return {
        "message": "Status updated successfully",
        "current_status": matter.current_status,
        "current_stage": matter.current_stage,
    }


@router.post("/{matter_id}/dispose")
def dispose_matter(
    matter_id: int,
    status: str = Form(...),
    order_date: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("matters:edit")),
):
    matter = db.query(Matter).filter(Matter.id == matter_id, Matter.is_deleted == False).first()
    if not matter:
        raise HTTPException(status_code=404, detail="Matter not found")

    ensure_matter_access(matter, current_user)

    if status not in {"Allowed", "Dismissed", "Disposed"}:
        raise HTTPException(status_code=400, detail="Invalid status")

    parsed_order_date = normalize_to_date(order_date)
    if not parsed_order_date:
        raise HTTPException(status_code=400, detail="Invalid date format (YYYY-MM-DD required)")

    relative_path = save_uploaded_file(matter, "orders", file)

    matter.current_status = status
    matter.current_stage = status
    matter.order_date = parsed_order_date
    matter.order_file = relative_path
    matter.is_disposed = True

    try:
        db.commit()
        db.refresh(matter)
    except Exception:
        db.rollback()
        raise

    safe_log_event(
        db=db,
        matter_id=matter.id,
        user_id=current_user.id,
        event_type="matter_disposed",
        title="Matter Disposed",
        description=f"Disposed as {status}",
        old_value=None,
        new_value=status,
    )

    try:
        client_invoice = db.query(ClientInvoice).filter(ClientInvoice.matter_id == matter.id).first()
        if client_invoice and not client_invoice.part2_file:
            generate_part2_invoice(db, matter)
    except Exception:
        pass

    return {"message": "Matter disposed successfully"}


@router.post("/{matter_id}/counsel-invoice")
def save_counsel_invoice(
    matter_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("matters:edit")),
):
    matter = db.query(Matter).filter(Matter.id == matter_id, Matter.is_deleted == False).first()
    if not matter:
        raise HTTPException(status_code=404, detail="Matter not found")

    ensure_matter_access(matter, current_user)

    invoice = db.query(CounselInvoice).filter(CounselInvoice.matter_id == matter_id).first()

    total_fee = Decimal(str(payload.get("total_fee") or 0))
    miscellaneous_fee = Decimal(str(payload.get("miscellaneous_fee") or 0))
    part1_fee = total_fee * 0.5
    part2_fee = total_fee * 0.5

    if not invoice:
        invoice = CounselInvoice(
            matter_id=matter_id,
            total_fee=total_fee,
            part1_fee=part1_fee,
            part2_fee=part2_fee,
            miscellaneous_fee=miscellaneous_fee,
        )
        db.add(invoice)
    else:
        invoice.total_fee = total_fee
        invoice.part1_fee = part1_fee
        invoice.part2_fee = part2_fee
        invoice.miscellaneous_fee = miscellaneous_fee

    try:
        db.commit()
        db.refresh(invoice)
    except Exception:
        db.rollback()
        raise

    return {"message": "Invoice saved successfully"}


@router.post("/{matter_id}/invoice/upload")
def upload_invoice_file(
    matter_id: int,
    type: str = Query(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("matters:edit")),
):
    matter = db.query(Matter).filter(Matter.id == matter_id, Matter.is_deleted == False).first()
    if not matter:
        raise HTTPException(status_code=404, detail="Matter not found")

    ensure_matter_access(matter, current_user)

    invoice = db.query(CounselInvoice).filter(CounselInvoice.matter_id == matter_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    file_type = (type or "").strip().lower()
    if file_type not in {"part1", "part2", "misc"}:
        raise HTTPException(status_code=400, detail="Invalid type")

    relative_path = save_uploaded_file(matter, "Counsel_Invoices", file, prefix=file_type.upper())

    if file_type == "part1":
        invoice.part1_file = relative_path
    elif file_type == "part2":
        invoice.part2_file = relative_path
    else:
        invoice.miscellaneous_file = relative_path

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise

    return {"message": "File uploaded successfully"}


@router.delete("/{matter_id}/invoice/delete")
def delete_invoice_file(
    matter_id: int,
    type: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("matters:edit")),
):
    matter = db.query(Matter).filter(Matter.id == matter_id, Matter.is_deleted == False).first()
    if not matter:
        raise HTTPException(status_code=404, detail="Matter not found")

    ensure_matter_access(matter, current_user)

    invoice = db.query(CounselInvoice).filter(CounselInvoice.matter_id == matter_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    file_type = (type or "").strip().lower()
    if file_type == "part1":
        old_path = invoice.part1_file
        invoice.part1_file = None
    elif file_type == "part2":
        old_path = invoice.part2_file
        invoice.part2_file = None
    elif file_type == "misc":
        old_path = invoice.miscellaneous_file
        invoice.miscellaneous_file = None
    else:
        raise HTTPException(status_code=400, detail="Invalid type")

    delete_relative_file(old_path)

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise

    return {"message": "File deleted successfully"}


@router.post("/{matter_id}/payment/upload")
def upload_payment_file(
    matter_id: int,
    type: str = Query(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("matters:edit")),
):
    matter = db.query(Matter).filter(Matter.id == matter_id, Matter.is_deleted == False).first()
    if not matter:
        raise HTTPException(status_code=404, detail="Matter not found")

    ensure_matter_access(matter, current_user)

    invoice = db.query(CounselInvoice).filter(CounselInvoice.matter_id == matter_id).first()
    if not invoice:
        raise HTTPException(status_code=400, detail="Invoice not found")

    payment = db.query(CounselPayment).filter(CounselPayment.matter_id == matter_id).first()
    if not payment:
        payment = CounselPayment(matter_id=matter_id)
        db.add(payment)
        try:
            db.commit()
            db.refresh(payment)
        except Exception:
            db.rollback()
            raise

    file_type = (type or "").strip().lower()
    if file_type not in {"part1", "part2", "misc"}:
        raise HTTPException(status_code=400, detail="Invalid payment type")

    relative_path = save_uploaded_file(matter, "Counsel_Payments", file, prefix=file_type.upper())

    if file_type == "part1":
        payment.part1_file = relative_path
        payment.part1_paid = invoice.part1_fee
        payment.part1_paid_at = datetime.utcnow()
    elif file_type == "part2":
        payment.part2_file = relative_path
        payment.part2_paid = invoice.part2_fee
        payment.part2_paid_at = datetime.utcnow()
    else:
        payment.miscellaneous_file = relative_path
        payment.miscellaneous_paid = invoice.miscellaneous_fee
        payment.miscellaneous_paid_at = datetime.utcnow()

    payment.total_payment = (
        (payment.part1_paid or Decimal("0"))
        + (payment.part2_paid or Decimal("0"))
        + (payment.miscellaneous_paid or Decimal("0"))
    )

    try:
        db.commit()
        db.refresh(payment)
    except Exception:
        db.rollback()
        raise

    return {"message": "Payment uploaded successfully"}


@router.delete("/{matter_id}/payment/delete")
def delete_payment_file(
    matter_id: int,
    type: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("matters:edit")),
):
    matter = db.query(Matter).filter(Matter.id == matter_id, Matter.is_deleted == False).first()
    if not matter:
        raise HTTPException(status_code=404, detail="Matter not found")

    ensure_matter_access(matter, current_user)

    payment = db.query(CounselPayment).filter(CounselPayment.matter_id == matter_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment record not found")

    file_type = (type or "").strip().lower()
    if file_type == "part1":
        old_path = payment.part1_file
        payment.part1_file = None
        payment.part1_paid = 0
        payment.part1_paid_at = None
    elif file_type == "part2":
        old_path = payment.part2_file
        payment.part2_file = None
        payment.part2_paid = 0
        payment.part2_paid_at = None
    elif file_type == "misc":
        old_path = payment.miscellaneous_file
        payment.miscellaneous_file = None
        payment.miscellaneous_paid = 0
        payment.miscellaneous_paid_at = None
    else:
        raise HTTPException(status_code=400, detail="Invalid payment type")

    delete_relative_file(old_path)

    payment.total_payment = (
        (payment.part1_paid or Decimal("0"))
        + (payment.part2_paid or Decimal("0"))
        + (payment.miscellaneous_paid or Decimal("0"))
    )

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise

    return {"message": "Payment file deleted successfully"}


@router.post("/{matter_id}/client-invoice")
def save_client_invoice(
    matter_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("matters:edit")),
):
    matter = db.query(Matter).filter(Matter.id == matter_id, Matter.is_deleted == False).first()
    if not matter:
        raise HTTPException(status_code=404, detail="Matter not found")

    ensure_matter_access(matter, current_user)

    invoice = db.query(ClientInvoice).filter(ClientInvoice.matter_id == matter_id).first()

    total_fee = float(payload.get("total_fee") or 0)
    miscellaneous_fee = float(payload.get("miscellaneous_fee") or 0)
    part1_fee = total_fee * 0.5
    part2_fee = total_fee * 0.5

    if not invoice:
        invoice = ClientInvoice(
            matter_id=matter_id,
            total_fee=total_fee,
            part1_fee=part1_fee,
            part2_fee=part2_fee,
            miscellaneous_fee=miscellaneous_fee,
        )
        db.add(invoice)
    else:
        invoice.total_fee = total_fee
        invoice.part1_fee = part1_fee
        invoice.part2_fee = part2_fee
        invoice.miscellaneous_fee = miscellaneous_fee

    try:
        db.commit()
        db.refresh(invoice)
    except Exception:
        db.rollback()
        raise

    return {"message": "Client invoice saved successfully"}


@router.post("/{matter_id}/client-invoice/upload")
def upload_client_invoice_file(
    matter_id: int,
    type: str = Query(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("matters:edit")),
):
    matter = db.query(Matter).filter(Matter.id == matter_id, Matter.is_deleted == False).first()
    if not matter:
        raise HTTPException(status_code=404, detail="Matter not found")

    ensure_matter_access(matter, current_user)

    invoice = db.query(ClientInvoice).filter(ClientInvoice.matter_id == matter_id).first()
    if not invoice:
        invoice = ClientInvoice(
            matter_id=matter_id,
            total_fee=0,
            part1_fee=0,
            part2_fee=0,
            miscellaneous_fee=0,
        )
        db.add(invoice)
        try:
            db.commit()
            db.refresh(invoice)
        except Exception:
            db.rollback()
            raise

    file_type = (type or "").strip().lower()
    if file_type not in {"part1", "part2", "misc"}:
        raise HTTPException(status_code=400, detail="Invalid type")

    relative_path = save_uploaded_file(matter, "Client_Invoices", file, prefix=file_type.upper())

    if file_type == "part1":
        invoice.part1_file = relative_path
    elif file_type == "part2":
        invoice.part2_file = relative_path
    else:
        invoice.miscellaneous_file = relative_path

    try:
        db.commit()
        db.refresh(invoice)
    except Exception:
        db.rollback()
        raise

    return {"message": "Client invoice file uploaded successfully"}


@router.delete("/{matter_id}/client-invoice/delete")
def delete_client_invoice_file(
    matter_id: int,
    type: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("matters:edit")),
):
    matter = db.query(Matter).filter(Matter.id == matter_id, Matter.is_deleted == False).first()
    if not matter:
        raise HTTPException(status_code=404, detail="Matter not found")

    ensure_matter_access(matter, current_user)

    invoice = db.query(ClientInvoice).filter(ClientInvoice.matter_id == matter_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Client invoice not found")

    file_type = (type or "").strip().lower()
    if file_type == "part1":
        old_path = invoice.part1_file
        invoice.part1_file = None
    elif file_type == "part2":
        old_path = invoice.part2_file
        invoice.part2_file = None
    elif file_type == "misc":
        old_path = invoice.miscellaneous_file
        invoice.miscellaneous_file = None
    else:
        raise HTTPException(status_code=400, detail="Invalid type")

    delete_relative_file(old_path)

    try:
        db.commit()
        db.refresh(invoice)
    except Exception:
        db.rollback()
        raise

    return {"message": "Client invoice file deleted successfully"}


@router.post("/{matter_id}/client-payment/upload")
def upload_client_payment_file(
    matter_id: int,
    type: str = Query(...),
    reference_no: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("matters:edit")),
):
    matter = db.query(Matter).filter(Matter.id == matter_id, Matter.is_deleted == False).first()
    if not matter:
        raise HTTPException(status_code=404, detail="Matter not found")

    ensure_matter_access(matter, current_user)

    invoice = db.query(ClientInvoice).filter(ClientInvoice.matter_id == matter_id).first()
    if not invoice:
        raise HTTPException(status_code=400, detail="Client invoice not found")

    payment = db.query(ClientPayment).filter(ClientPayment.matter_id == matter_id).first()
    if not payment:
        payment = ClientPayment(matter_id=matter_id)
        db.add(payment)
        try:
            db.commit()
            db.refresh(payment)
        except Exception:
            db.rollback()
            raise

    file_type = (type or "").strip().lower()
    if file_type not in {"part1", "part2", "misc"}:
        raise HTTPException(status_code=400, detail="Invalid type")

    relative_path = save_uploaded_file(matter, "Client_Payments", file, prefix=file_type.upper())

    if file_type == "part1":
        payment.part1_file = relative_path
        payment.part1_paid = invoice.part1_fee
        payment.part1_paid_at = datetime.utcnow()
        payment.part1_reference_no = reference_no
    elif file_type == "part2":
        payment.part2_file = relative_path
        payment.part2_paid = invoice.part2_fee
        payment.part2_paid_at = datetime.utcnow()
        payment.part2_reference_no = reference_no
    else:
        payment.miscellaneous_file = relative_path
        payment.miscellaneous_paid = invoice.miscellaneous_fee
        payment.miscellaneous_paid_at = datetime.utcnow()
        payment.miscellaneous_reference_no = reference_no

    payment.total_payment = (
        (payment.part1_paid or Decimal("0"))
        + (payment.part2_paid or Decimal("0"))
        + (payment.miscellaneous_paid or Decimal("0"))
    )

    try:
        db.commit()
        db.refresh(payment)
    except Exception:
        db.rollback()
        raise

    return {"message": "Client payment recorded successfully"}


@router.delete("/{matter_id}/client-payment/delete")
def delete_client_payment_file(
    matter_id: int,
    type: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("matters:edit")),
):
    matter = db.query(Matter).filter(Matter.id == matter_id, Matter.is_deleted == False).first()
    if not matter:
        raise HTTPException(status_code=404, detail="Matter not found")

    ensure_matter_access(matter, current_user)

    payment = db.query(ClientPayment).filter(ClientPayment.matter_id == matter_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment record not found")

    file_type = (type or "").strip().lower()
    if file_type == "part1":
        old_path = payment.part1_file
        payment.part1_file = None
        payment.part1_paid = 0
        payment.part1_paid_at = None
        payment.part1_reference_no = None
    elif file_type == "part2":
        old_path = payment.part2_file
        payment.part2_file = None
        payment.part2_paid = 0
        payment.part2_paid_at = None
        payment.part2_reference_no = None
    elif file_type == "misc":
        old_path = payment.miscellaneous_file
        payment.miscellaneous_file = None
        payment.miscellaneous_paid = 0
        payment.miscellaneous_paid_at = None
        payment.miscellaneous_reference_no = None
    else:
        raise HTTPException(status_code=400, detail="Invalid type")

    delete_relative_file(old_path)

    payment.total_payment = (
        (payment.part1_paid or Decimal("0"))
        + (payment.part2_paid or Decimal("0"))
        + (payment.miscellaneous_paid or Decimal("0"))
    )

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise

    return {"message": "Client payment deleted successfully"}


@router.put("/{matter_id}/basic")
def update_matter_basic(
    matter_id: int,
    payload: MatterBasicUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("matters:edit")),
):
    matter = db.query(Matter).filter(Matter.id == matter_id, Matter.is_deleted == False).first()
    if not matter:
        raise HTTPException(status_code=404, detail="Matter not found")

    ensure_matter_access(matter, current_user)

    data = payload.dict(exclude_unset=True)

    if "client_id" in data and data["client_id"] is not None:
        client = db.query(Client).filter(Client.id == data["client_id"]).first()
        if not client:
            raise HTTPException(status_code=400, detail="Invalid client ID")
        matter.client_id = data["client_id"]

    if "forum_id" in data and data["forum_id"] is not None:
        forum = db.query(Forum).filter(Forum.id == data["forum_id"]).first()
        if not forum:
            raise HTTPException(status_code=400, detail="Invalid forum ID")
        matter.forum_id = data["forum_id"]

    simple_fields = [
        "matter_name",
        "case_no",
        "dc_sc_no",
        "summary",
        "allegation",
        "comments",
        "pleadings_status",
        "current_status",
        "current_stage",
        "outcome",
        "client_share",
        "client_savings",
        "product_id",
    ]

    # ✅ FIX CLAIM AMOUNT (DECIMAL SAFE)
    if "claim_amount" in data:
        matter.claim_amount = (
            Decimal(str(data["claim_amount"]))
            if data["claim_amount"] not in (None, "")
            else None
        )

    for field in simple_fields:
        if field in data:
            setattr(matter, field, data[field])

    date_fields = ["ndoh", "ldoh", "allocation_date", "reply_filed_date"]
    for field in date_fields:
        if field in data:
            setattr(matter, field, normalize_to_date(data[field]))

    if matter.current_status in FINAL_STATUSES:
        matter.is_disposed = True

    if "current_stage" not in data:
        matter.current_stage = compute_current_stage(matter)
    
    matter.updated_by = current_user.id

    try:
        db.commit()
        db.refresh(matter)
    except Exception:
        db.rollback()
        raise

    return {"message": "Matter updated successfully"}


@router.post("/{matter_id}/assign-gnp")
def assign_gnp_counsel(
    matter_id: int,
    payload: AssignGNPCounselRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("matters:edit")),
):
    matter = db.query(Matter).filter(Matter.id == matter_id, Matter.is_deleted == False).first()
    if not matter:
        raise HTTPException(status_code=404, detail="Matter not found")

    ensure_matter_access(matter, current_user)

    lawyer = db.query(User).filter(User.id == payload.counsel_id).first()
    if not lawyer:
        raise HTTPException(status_code=404, detail="GNP lawyer not found")

    role_value = (lawyer.role or "").strip().lower()
    role_name_value = (lawyer.role_obj.name or "").strip().lower() if lawyer.role_obj else ""

    if role_value != "gnp counsel" and role_name_value != "gnp counsel":
        raise HTTPException(status_code=400, detail="Selected user is not a GNP Counsel")

    matter.gnp_lawyer_id = lawyer.id

    try:
        db.commit()
        db.refresh(matter)
    except Exception as e:
        import logging
        logging.error(f"Event logging failed: {str(e)}")

    safe_log_event(
        db=db,
        matter_id=matter.id,
        user_id=current_user.id,
        event_type="gnp_lawyer_assigned",
        title="GNP Lawyer Assigned",
        description=lawyer.full_name,
        new_value=str(lawyer.id),
    )

    return {"message": "GNP counsel assigned successfully"}


@router.post("/{matter_id}/assign-local")
def assign_local_counsel(
    matter_id: int,
    payload: AssignCounselRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("matters:edit")),
):
    matter = db.query(Matter).filter(Matter.id == matter_id, Matter.is_deleted == False).first()
    if not matter:
        raise HTTPException(status_code=404, detail="Matter not found")

    ensure_matter_access(matter, current_user)

    counsel = db.query(LocalCounsel).filter(LocalCounsel.id == payload.counsel_id).first()
    if not counsel:
        raise HTTPException(status_code=404, detail="Counsel not found")

    db.query(MatterLocalCounsel).filter(MatterLocalCounsel.matter_id == matter_id).delete()

    new_assignment = MatterLocalCounsel(
        matter_id=matter_id,
        local_counsel_id=counsel.id,
    )
    db.add(new_assignment)

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise

    safe_log_event(
        db=db,
        matter_id=matter.id,
        user_id=current_user.id,
        event_type="local_counsel_assigned",
        title="Local Counsel Assigned",
        description=counsel.name,
        new_value=str(counsel.id),
    )

    return {"message": "Local counsel assigned successfully"}


@router.delete("/{matter_id}/delete")
def delete_matter(
    matter_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("matters:delete")),
):
    matter = db.query(Matter).filter(Matter.id == matter_id, Matter.is_deleted == False).first()
    if not matter:
        raise HTTPException(status_code=404, detail="Matter not found")

    ensure_matter_access(matter, current_user)

    documents = db.query(MatterDocument).filter(MatterDocument.matter_id == matter_id).all()
    counsel_invoice = db.query(CounselInvoice).filter(CounselInvoice.matter_id == matter_id).first()
    counsel_payment = db.query(CounselPayment).filter(CounselPayment.matter_id == matter_id).first()
    client_invoice = db.query(ClientInvoice).filter(ClientInvoice.matter_id == matter_id).first()
    client_payment = db.query(ClientPayment).filter(ClientPayment.matter_id == matter_id).first()

    for doc in documents:
        delete_relative_file(doc.file_path)

    if counsel_invoice:
        delete_relative_file(counsel_invoice.part1_file)
        delete_relative_file(counsel_invoice.part2_file)
        delete_relative_file(counsel_invoice.miscellaneous_file)

    if counsel_payment:
        delete_relative_file(counsel_payment.part1_file)
        delete_relative_file(counsel_payment.part2_file)
        delete_relative_file(counsel_payment.miscellaneous_file)

    if client_invoice:
        delete_relative_file(client_invoice.part1_file)
        delete_relative_file(client_invoice.part2_file)
        delete_relative_file(client_invoice.miscellaneous_file)

    if client_payment:
        delete_relative_file(client_payment.part1_file)
        delete_relative_file(client_payment.part2_file)
        delete_relative_file(client_payment.miscellaneous_file)

    delete_relative_file(getattr(matter, "order_file", None))

    # Optional: keep documents physically deleted
    for doc in documents:
        delete_relative_file(doc.file_path)

    # Soft delete only main record
    matter.is_deleted = True
    matter.is_active = False

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise

    return {"message": "Matter deleted successfully"}

@router.post("/{matter_id}/assign")
def assign_counsel_unified(
    matter_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("matters:edit")),
):
    """
    Unified assign endpoint (used by frontend)
    Handles BOTH:
    - local counsel assignment
    - GNP lawyer assignment
    """

    matter = db.query(Matter).filter(Matter.id == matter_id, Matter.is_deleted == False).first()
    if not matter:
        raise HTTPException(status_code=404, detail="Matter not found")

    ensure_matter_access(matter, current_user)

    counsel_id = payload.get("counsel_id")
    type_ = (payload.get("type") or "local").strip().lower()

    if not counsel_id:
        raise HTTPException(status_code=400, detail="counsel_id is required")

    # ============================
    # LOCAL COUNSEL
    # ============================
    if type_ == "local":
        from app.models.local_counsel import LocalCounsel, MatterLocalCounsel

        counsel = db.query(LocalCounsel).filter(LocalCounsel.id == counsel_id).first()
        if not counsel:
            raise HTTPException(status_code=404, detail="Counsel not found")

        # remove old
        db.query(MatterLocalCounsel).filter(
            MatterLocalCounsel.matter_id == matter_id
        ).delete()

        db.add(
            MatterLocalCounsel(
                matter_id=matter_id,
                local_counsel_id=counsel.id,
            )
        )

    # ============================
    # GNP COUNSEL
    # ============================
    elif type_ == "gnp":
        from app.models.user import User

        lawyer = db.query(User).filter(
            User.id == payload.counsel_id
        ).first()

        if not lawyer:
            raise HTTPException(status_code=404, detail="GNP lawyer not found")

        matter.gnp_lawyer_id = lawyer.id

    else:
        raise HTTPException(status_code=400, detail="Invalid type")

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise

    return {"message": "Counsel assigned successfully"}

@router.post("/{matter_id}/upload")
def upload_document_compat(
    matter_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("matters:edit")),
):
    """
    Compatibility route for frontend
    Maps /upload → /documents
    """

    matter = db.query(Matter).filter(Matter.id == matter_id, Matter.is_deleted == False).first()
    if not matter:
        raise HTTPException(status_code=404, detail="Matter not found")

    ensure_matter_access(matter, current_user)

    relative_path = save_uploaded_file(matter, "documents", file)

    doc = MatterDocument(
        matter_id=matter_id,
        file_name=file.filename,
        file_path=relative_path,
    )

    db.add(doc)

    try:
        db.commit()
        db.refresh(doc)
    except Exception:
        db.rollback()
        raise

    return {
        "message": "Document uploaded successfully",
        "document_id": doc.id,
        "file_url": build_file_url(doc.file_path),
    }

@router.post("/{matter_id}/documents/upload")
def upload_document_alt(
    matter_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("matters:edit")),
):
    return upload_document_compat(matter_id, file, db, current_user)

@router.options("/{matter_id}/assign-gnp")
def assign_gnp_options(matter_id: int):
    return {"message": "OK"}

@router.get("/{matter_id}")
def get_matter_by_id(
    matter_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("matters:view")),
):
    matter = (
        db.query(Matter)
        .options(
            joinedload(Matter.client),
            joinedload(Matter.forum).joinedload(Forum.district),
            joinedload(Matter.forum).joinedload(Forum.state),
            joinedload(Matter.gnp_lawyer),
        )
        .filter(
            Matter.id == matter_id,
            Matter.is_deleted == False
        )
        .first()
    )

    if not matter:
        raise HTTPException(status_code=404, detail="Matter not found")

    ensure_matter_access(matter, current_user)

    local_counsel = (
        db.query(LocalCounsel)
        .join(MatterLocalCounsel, LocalCounsel.id == MatterLocalCounsel.local_counsel_id)
        .filter(MatterLocalCounsel.matter_id == matter.id)
        .first()
    )

    documents = (
        db.query(MatterDocument)
        .filter(MatterDocument.matter_id == matter.id)
        .order_by(MatterDocument.id.desc())
        .all()
    )

    counsel_invoice = db.query(CounselInvoice).filter(CounselInvoice.matter_id == matter.id).first()
    counsel_payment = db.query(CounselPayment).filter(CounselPayment.matter_id == matter.id).first()
    client_invoice = db.query(ClientInvoice).filter(ClientInvoice.matter_id == matter.id).first()
    client_payment = db.query(ClientPayment).filter(ClientPayment.matter_id == matter.id).first()

    district = getattr(matter.forum, "district", None) if matter.forum else None
    forum_state = getattr(matter.forum, "state", None) if matter.forum else None
    district_state = getattr(district, "state", None) if district else None

    state_name = None
    if district_state and getattr(district_state, "name", None):
        state_name = district_state.name
    elif forum_state and getattr(forum_state, "name", None):
        state_name = forum_state.name
    
    today = date.today()
    priority = "normal"

    if matter.ndoh:
        days_left = (matter.ndoh - today).days

        if days_left == 0:
            priority = "today"
        elif days_left == 1:
            priority = "tomorrow"
        elif days_left <= 3:
            priority = "urgent"

    return {
        "id": matter.id,
        "internal_case_no": matter.internal_case_no,
        "matter_name": matter.matter_name,
        "case_no": matter.case_no,
        "dc_sc_no": getattr(matter, "dc_sc_no", None),
        "client_id": matter.client_id,
        "client_name": matter.client.legal_name if matter.client else None,
        "forum_id": matter.forum_id,
        "forum": matter.forum.name if matter.forum else None,
        "state": state_name,
        "city": district.name if district else None,
        "summary": getattr(matter, "summary", None),
        "allegation": getattr(matter, "allegation", None),
        "comments": getattr(matter, "comments", None),
        "claim_amount": matter.claim_amount,
        "allocation_date": getattr(matter, "allocation_date", None),
        "reply_filed_date": getattr(matter, "reply_filed_date", None),
        "pleadings_status": getattr(matter, "pleadings_status", None),
        "current_status": matter.current_status,
        "current_stage": matter.current_stage,
        "ndoh": matter.ndoh,
        "ldoh": matter.ldoh,
        "order_date": getattr(matter, "order_date", None),
        "order_file": file_url_or_none(getattr(matter, "order_file", None)),
        "is_disposed": getattr(matter, "is_disposed", 0),
        "outcome": getattr(matter, "outcome", None),
        "client_share": getattr(matter, "client_share", None),
        "client_savings": getattr(matter, "client_savings", None),
        "product_id": getattr(matter, "product_id", None),
        "gnp_lawyer_id": matter.gnp_lawyer_id,
        "priority": priority,
        "gnp_counsel": (
            {
                "id": matter.gnp_lawyer.id,
                "full_name": matter.gnp_lawyer.full_name,
                "email": matter.gnp_lawyer.email,
            }
            if matter.gnp_lawyer
            else None
        ),
        "counsel": (
            {
                "id": local_counsel.id,
                "name": local_counsel.name,
                "email": local_counsel.email,
                "phone": local_counsel.phone,
                "alternate_phone": getattr(local_counsel, "alternate_phone", None),
                "city": getattr(local_counsel, "city", None),
                "state": getattr(local_counsel, "state", None),
                "postal_address": getattr(local_counsel, "postal_address", None),
                "bar_registration_no": getattr(local_counsel, "bar_registration_no", None),
                "pan_no": getattr(local_counsel, "pan_no", None),
                "upi_details": getattr(local_counsel, "upi_details", None),
                "reference": getattr(local_counsel, "reference", None),
                "created_at": getattr(local_counsel, "created_at", None),
            }
            if local_counsel
            else None
        ),
        "documents": [
            {
                "id": doc.id,
                "file_name": doc.file_name,
                "file_path": doc.file_path,
                "file_url": build_file_url(doc.file_path),
                "uploaded_at": getattr(doc, "uploaded_at", None),
            }
            for doc in documents
        ],
        "counsel_invoice": (
            {
                "total_fee": counsel_invoice.total_fee,
                "part1_fee": counsel_invoice.part1_fee,
                "part2_fee": counsel_invoice.part2_fee,
                "miscellaneous_fee": counsel_invoice.miscellaneous_fee,
                "part1_file": file_url_or_none(counsel_invoice.part1_file),
                "part2_file": file_url_or_none(counsel_invoice.part2_file),
                "miscellaneous_file": file_url_or_none(counsel_invoice.miscellaneous_file),
            }
            if counsel_invoice
            else None
        ),
        "counsel_payment": (
            {
                "total_payment": getattr(counsel_payment, "total_payment", None),
                "part1_paid": counsel_payment.part1_paid,
                "part2_paid": counsel_payment.part2_paid,
                "miscellaneous_paid": counsel_payment.miscellaneous_paid,
                "part1_paid_at": counsel_payment.part1_paid_at,
                "part2_paid_at": counsel_payment.part2_paid_at,
                "miscellaneous_paid_at": counsel_payment.miscellaneous_paid_at,
                "part1_file": file_url_or_none(counsel_payment.part1_file),
                "part2_file": file_url_or_none(counsel_payment.part2_file),
                "miscellaneous_file": file_url_or_none(counsel_payment.miscellaneous_file),
            }
            if counsel_payment
            else None
        ),
        "client_invoice": (
            {
                "total_fee": client_invoice.total_fee,
                "part1_fee": client_invoice.part1_fee,
                "part2_fee": client_invoice.part2_fee,
                "miscellaneous_fee": client_invoice.miscellaneous_fee,
                "part1_file": file_url_or_none(client_invoice.part1_file),
                "part2_file": file_url_or_none(client_invoice.part2_file),
                "miscellaneous_file": file_url_or_none(client_invoice.miscellaneous_file),
            }
            if client_invoice
            else None
        ),
        "client_payment": (
            {
                "total_payment": getattr(client_payment, "total_payment", None),
                "part1_paid": client_payment.part1_paid,
                "part2_paid": client_payment.part2_paid,
                "miscellaneous_paid": client_payment.miscellaneous_paid,
                "part1_paid_at": client_payment.part1_paid_at,
                "part2_paid_at": client_payment.part2_paid_at,
                "miscellaneous_paid_at": client_payment.miscellaneous_paid_at,
                "part1_file": file_url_or_none(client_payment.part1_file),
                "part2_file": file_url_or_none(client_payment.part2_file),
                "miscellaneous_file": file_url_or_none(client_payment.miscellaneous_file),
                "part1_reference_no": getattr(client_payment, "part1_reference_no", None),
                "part2_reference_no": getattr(client_payment, "part2_reference_no", None),
                "miscellaneous_reference_no": getattr(client_payment, "miscellaneous_reference_no", None),
            }
            if client_payment
            else None
        ),
    }
