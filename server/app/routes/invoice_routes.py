import os
import uuid
import pandas as pd

from datetime import datetime, date
from typing import Optional

from docx import Document
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, joinedload

from app.database import SessionLocal
from app.models.client import Client
from app.models.invoice import Invoice
from app.models.invoice_matter import InvoiceMatter
from app.models.invoice_payment import InvoicePayment
from app.models.matter import Matter
from app.models.user import User
from app.services.auth import get_current_user
from app.services.invoice_number_service import generate_invoice_number
from app.services.invoice_pdf import build_invoice_pdf, save_invoice_pdf
from app.services.invoice_docx_service import generate_invoice_docx
from app.models.client_spoc import ClientSPOC
from app.models.client_invoice import ClientInvoice
from io import BytesIO
from openpyxl.styles import Alignment

router = APIRouter(tags=["Invoices"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def require_permission(user: User, permission: str):
    perms = getattr(user, "permission_map", {}) or {}
    if perms.get("*"):
        return
    if not perms.get(permission):
        raise HTTPException(status_code=403, detail="Permission denied")


LOCKED_STATUSES = {"finalized", "paid", "partial"}
DONE_STATUSES = {"finalized", "paid", "partial"}


class GenerateConsolidatedInvoicePayload(BaseModel):
    client_id: int
    matter_ids: list[int] = Field(default_factory=list)
    month: int
    year: int
    invoice_type: str
    selected_spoc_id: Optional[int] = None


class MiscInvoicePayload(BaseModel):
    matter_ids: list[int] = Field(default_factory=list)
    amount: float


class UpdateInvoiceTotalPayload(BaseModel):
    final_total: float
    selected_spoc_id: Optional[int] = None


class RecordPaymentPayload(BaseModel):
    amount: float
    payment_mode: Optional[str] = None
    reference_no: Optional[str] = None
    remarks: Optional[str] = None


def normalize_invoice_type(value: Optional[str]) -> str:
    raw = (value or "").strip().upper()
    if raw not in {"PART1", "PART2", "MISC"}:
        raise HTTPException(status_code=400, detail="Invalid invoice type")
    return raw


def invoice_mode_for(invoice_type: Optional[str]) -> str:
    if (invoice_type or "").upper() in {"PART1", "PART2"}:
        return "CONSOLIDATED"
    return "NORMAL"


def status_label_for(status: Optional[str]) -> str:
    mapping = {
        "draft": "Draft",
        "finalized": "Raised",
        "paid": "Paid",
        "partial": "Partial Paid",
    }
    return mapping.get((status or "").lower(), status or "Draft")


def is_locked(invoice: Invoice) -> bool:
    return (invoice.status or "").lower() in LOCKED_STATUSES


def get_client_or_404(db: Session, client_id: int) -> Client:
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return client


def get_invoice_or_404(db: Session, invoice_id: int) -> Invoice:
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice


def ensure_user_can_access_client(current_user: User, client_id: int):
    role = (current_user.role or "").lower()
    if role == "client" and getattr(current_user, "client_id", None) != client_id:
        raise HTTPException(status_code=403, detail="Access denied")


def ensure_user_can_access_matter(current_user: User, matter: Matter):
    role = (current_user.role or "").lower()

    if role == "client":
        if matter.client_id != getattr(current_user, "client_id", None):
            raise HTTPException(status_code=403, detail="Access denied")

    if role == "lawyer":
        if matter.gnp_lawyer_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")


def ensure_user_can_access_invoice(db: Session, current_user: User, invoice: Invoice):
    role = (current_user.role or "").lower()

    if role == "client":
        if invoice.client_id != getattr(current_user, "client_id", None):
            raise HTTPException(status_code=403, detail="Access denied")

    if role == "lawyer":
        matter_ids = [
            row.matter_id
            for row in db.query(InvoiceMatter).filter(InvoiceMatter.invoice_id == invoice.id).all()
        ]
        if matter_ids:
            count = db.query(Matter).filter(
                Matter.id.in_(matter_ids),
                Matter.gnp_lawyer_id == current_user.id,
            ).count()
            if count == 0:
                raise HTTPException(status_code=403, detail="Access denied")


def get_invoice_items(db: Session, invoice_id: int) -> list[InvoiceMatter]:
    return db.query(InvoiceMatter).filter(InvoiceMatter.invoice_id == invoice_id).all()


def get_latest_invoice_for_matter(db: Session, matter_id: int, invoice_type: str) -> Optional[Invoice]:
    return (
        db.query(Invoice)
        .join(InvoiceMatter, InvoiceMatter.invoice_id == Invoice.id)
        .filter(
            InvoiceMatter.matter_id == matter_id,
            Invoice.invoice_type == invoice_type,
        )
        .order_by(
            Invoice.finalized_at.desc().nullslast(),
            Invoice.created_at.desc(),
            Invoice.id.desc()
        )
        .first()
    )

def get_done_invoice_for_matter(db: Session, matter_id: int, invoice_type: str) -> Optional[Invoice]:
    return (
        db.query(Invoice)
        .join(InvoiceMatter, InvoiceMatter.invoice_id == Invoice.id)
        .filter(
            InvoiceMatter.matter_id == matter_id,
            Invoice.invoice_type == invoice_type,
            Invoice.status.in_(DONE_STATUSES)  # ✅ Only finalized/paid/partial
        )
        .order_by(
            Invoice.finalized_at.desc().nullslast(),
            Invoice.created_at.desc(),
            Invoice.id.desc()
        )
        .first()
    )


def matter_phase_done(db: Session, matter_id: int, invoice_type: str) -> bool:
    return get_done_invoice_for_matter(db, matter_id, invoice_type) is not None


def compute_line_amount(db: Session, matter: Matter, invoice_type: str) -> float:
    client_invoice = (
        db.query(ClientInvoice)
        .filter(ClientInvoice.matter_id == matter.id)
        .first()
    )

    if invoice_type == "PART1":
        if client_invoice:
            return round(float(client_invoice.part1_fee or 0), 2)
        return 0.0

    if invoice_type == "PART2":
        if client_invoice:
            return round(float(client_invoice.part2_fee or 0), 2)
        return 0.0

    if invoice_type == "MISC":
        if client_invoice:
            return round(float(client_invoice.miscellaneous_fee or 0), 2)
        return 0.0

    return 0.0


def get_invoice_client_name(db: Session, invoice: Invoice) -> str:
    client = db.query(Client).filter(Client.id == invoice.client_id).first()
    return client.legal_name if client else "-"


def get_invoice_matter_pairs(db: Session, invoice: Invoice) -> list[tuple[Matter, float]]:
    pairs: list[tuple[Matter, float]] = []
    for item in get_invoice_items(db, invoice.id):
        matter = db.query(Matter).filter(Matter.id == item.matter_id).first()
        if matter:
            pairs.append((matter, float(item.amount or 0)))
    return pairs


def apply_invoice_access_filter(query, current_user: User):
    role = (current_user.role or "").lower()

    if role == "client" and getattr(current_user, "client_id", None):
        query = query.filter(Invoice.client_id == current_user.client_id)
    elif role == "lawyer":
        query = query.join(InvoiceMatter, InvoiceMatter.invoice_id == Invoice.id).join(
            Matter, Matter.id == InvoiceMatter.matter_id
        ).filter(Matter.gnp_lawyer_id == current_user.id)

    return query


@router.post("/generate-consolidated")
def generate_consolidated_invoice(
    payload: GenerateConsolidatedInvoicePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "invoices:view")

    invoice_type = normalize_invoice_type(payload.invoice_type)

    if invoice_type == "MISC":
        raise HTTPException(status_code=400, detail="Use /invoices/misc for misc invoices")

    if not payload.matter_ids:
        raise HTTPException(status_code=400, detail="No matters selected")

    ensure_user_can_access_client(current_user, payload.client_id)
    client = get_client_or_404(db, payload.client_id)

    matters = db.query(Matter).filter(Matter.id.in_(payload.matter_ids)).all()
    if len(matters) != len(payload.matter_ids):
        raise HTTPException(status_code=400, detail="Some matters were not found")

    # ================= VALIDATIONS =================
    for matter in matters:
        ensure_user_can_access_matter(current_user, matter)

        if matter.client_id != payload.client_id:
            raise HTTPException(status_code=400, detail="All selected matters must belong to the same client")

        if invoice_type == "PART1" and matter_phase_done(db, matter.id, "PART1"):
            raise HTTPException(status_code=400, detail=f"Part-1 invoice already exists for matter {matter.matter_name}")

        if invoice_type == "PART2" and matter_phase_done(db, matter.id, "PART2"):
            raise HTTPException(status_code=400, detail=f"Part-2 invoice already exists for matter {matter.matter_name}")
        
         # 🔥 ADD THIS BLOCK HERE
        client_invoice = (
            db.query(ClientInvoice)
            .filter(ClientInvoice.matter_id == matter.id)
            .first()
        )

        if not client_invoice:
            raise HTTPException(
                status_code=400,
                detail=f"Client invoice not configured for matter {matter.matter_name}"
            )

        if invoice_type == "PART1" and float(client_invoice.part1_fee or 0) <= 0:
            raise HTTPException(
                status_code=400,
                detail=f"Part-1 fee not set for matter {matter.matter_name}"
            )

        if invoice_type == "PART2" and float(client_invoice.part2_fee or 0) <= 0:
            raise HTTPException(
                status_code=400,
                detail=f"Part-2 fee not set for matter {matter.matter_name}"
            )

    # ================= CREATE INVOICE =================
    attempt = 0
    while True:
        try:
            invoice = Invoice(
                invoice_no=generate_invoice_number(db),
                client_id=client.id,
                invoice_type=invoice_type,
                status="draft",
                subtotal=0,
                tax=0,
                final_total=0,
                selected_spoc_id=payload.selected_spoc_id,
                notes=f"{invoice_type} invoice for {payload.month}/{payload.year}",
            )

            db.add(invoice)
            db.commit()
            db.refresh(invoice)
            break

        except Exception as e:
            db.rollback()

            # retry only if it's duplicate invoice_no
            if "UNIQUE constraint failed: invoices.invoice_no" in str(e):
                attempt += 1
                if attempt > 5:
                    raise HTTPException(status_code=500, detail="Failed to generate unique invoice number")
                continue
            else:
                raise e

    # ================= ADD MATTERS =================
    subtotal = 0.0

    for matter in matters:
        amount = compute_line_amount(db, matter, invoice_type)
        subtotal += amount

        db.add(
            InvoiceMatter(
                invoice_id=invoice.id,
                matter_id=matter.id,
                amount=amount,
            )
        )

    invoice.subtotal = round(subtotal, 2)
    invoice.tax = 0
    invoice.final_total = round(subtotal, 2)

    db.commit()
    db.refresh(invoice)

    # ================= FETCH SPOC =================
    spoc = None
    if invoice.selected_spoc_id:
        spoc = db.query(ClientSPOC).filter(
            ClientSPOC.id == invoice.selected_spoc_id
        ).first()

    # ================= FETCH INVOICE MATTERS (IMPORTANT FIX) =================
    invoice_matters = (
        db.query(InvoiceMatter)
        .filter(InvoiceMatter.invoice_id == invoice.id)
        .all()
    )

    # Map actual Matter objects with amount
    enriched_matters = []
    for im in invoice_matters:
        m = db.query(Matter).filter(Matter.id == im.matter_id).first()
        if m:
            m.client_share = im.amount  # 🔥 inject amount for template
            enriched_matters.append(m)

    # ================= GENERATE DOCX =================
    file_path = generate_invoice_docx(
        invoice=invoice,
        client=client,
        spoc=spoc,
        matters=enriched_matters
    )

    invoice.generated_docx_path = file_path
    db.commit()

    # ================= RESPONSE =================
    return {
        "ok": True,
        "invoice_id": invoice.id,
        "invoice_number": invoice.invoice_no,
        "client": client.legal_name,
        "invoice_type": invoice.invoice_type,
        "status": invoice.status,
    }

@router.post("/misc")
def create_misc_invoice(
    payload: MiscInvoicePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "invoices:view")

    if not payload.matter_ids:
        raise HTTPException(status_code=400, detail="No matters selected")

    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid amount")

    matters = db.query(Matter).filter(Matter.id.in_(payload.matter_ids)).all()
    if len(matters) != len(payload.matter_ids):
        raise HTTPException(status_code=400, detail="Some matters were not found")

    client_ids = {m.client_id for m in matters}
    if len(client_ids) != 1:
        raise HTTPException(status_code=400, detail="All selected matters must belong to the same client")

    client_id = next(iter(client_ids))
    ensure_user_can_access_client(current_user, client_id)

    for matter in matters:
        ensure_user_can_access_matter(current_user, matter)

    invoice = Invoice(
        invoice_no=generate_invoice_number(db),
        client_id=client_id,
        invoice_type="MISC",
        status="draft",
        subtotal=round(float(payload.amount), 2),
        tax=0,
        final_total=round(float(payload.amount), 2),
        notes="Misc invoice",
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)

    each_amount = round(float(payload.amount) / len(matters), 2)
    running_total = 0.0

    for idx, matter in enumerate(matters):
        amount = each_amount
        if idx == len(matters) - 1:
            amount = round(float(payload.amount) - running_total, 2)
        running_total += amount

        db.add(
            InvoiceMatter(
                invoice_id=invoice.id,
                matter_id=matter.id,
                amount=amount,
            )
        )

    db.commit()
    db.refresh(invoice)

    return {
        "ok": True,
        "invoice_id": invoice.id,
        "invoice_number": invoice.invoice_no,
        "invoice_type": invoice.invoice_type,
        "status": invoice.status,
    }


@router.get("/list")
def list_invoices(
    client_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    invoice_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "invoices:view")

    query = db.query(Invoice)
    query = apply_invoice_access_filter(query, current_user)

    if client_id:
        query = query.filter(Invoice.client_id == client_id)
    if status:
        query = query.filter(Invoice.status == status)
    if invoice_type:
        query = query.filter(Invoice.invoice_type == invoice_type)

    invoices = query.order_by(Invoice.id.desc()).all()

    results = []
    for inv in invoices:
        items = get_invoice_items(db, inv.id)
        matters = [db.query(Matter).filter(Matter.id == x.matter_id).first() for x in items]
        matters = [m for m in matters if m]

        if len(matters) == 1:
            matter_name = matters[0].matter_name
        elif len(matters) > 1:
            matter_name = f"{len(matters)} matters"
        else:
            matter_name = "-"

        results.append(
            {
                "id": inv.id,
                "invoice_id": inv.id,
                "invoice_number": inv.invoice_no,
                "client": get_invoice_client_name(db, inv),
                "matter_name": matter_name,
                "invoice_type": inv.invoice_type,
                "invoice_mode": invoice_mode_for(inv.invoice_type),
                "amount": round(float(inv.final_total or 0), 2),
                "status": status_label_for(inv.status),
                "is_locked": is_locked(inv),
            }
        )

    return results


@router.get("/{invoice_id}/preview")
def preview_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "invoices:view")

    invoice = get_invoice_or_404(db, invoice_id)
    ensure_user_can_access_invoice(db, current_user, invoice)

    pairs = get_invoice_matter_pairs(db, invoice)

    return {
        "invoice_id": invoice.id,
        "invoice_number": invoice.invoice_no,
        "client": get_invoice_client_name(db, invoice),
        "matters": [
            {
                "matter_name": matter.matter_name,
                "case_no": matter.case_no,
                "forum": getattr(matter.forum, "name", None) or "-",
                "amount": round(float(amount or 0), 2),
            }
            for matter, amount in pairs
        ],
        "final_total": round(float(invoice.final_total or 0), 2),
        "selected_spoc_id": invoice.selected_spoc_id,
    }


@router.put("/{invoice_id}/update-total")
def update_invoice_total(
    invoice_id: int,
    payload: UpdateInvoiceTotalPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "invoices:view")

    invoice = get_invoice_or_404(db, invoice_id)
    ensure_user_can_access_invoice(db, current_user, invoice)

    if is_locked(invoice):
        raise HTTPException(status_code=400, detail="Locked invoice cannot be edited")
    if payload.final_total < 0:
        raise HTTPException(status_code=400, detail="Invalid invoice total")

    invoice.final_total = round(float(payload.final_total), 2)
    invoice.selected_spoc_id = payload.selected_spoc_id
    db.add(invoice)
    db.commit()
    db.refresh(invoice)

    return {
        "ok": True,
        "invoice_id": invoice.id,
        "final_total": round(float(invoice.final_total or 0), 2),
        "selected_spoc_id": invoice.selected_spoc_id,
    }


@router.post("/{invoice_id}/finalize")
def finalize_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "invoices:view")

    invoice = get_invoice_or_404(db, invoice_id)
    ensure_user_can_access_invoice(db, current_user, invoice)

    if is_locked(invoice):
        return {"ok": True, "invoice_id": invoice.id, "status": invoice.status}

    if invoice.invoice_type in {"PART1", "PART2"} and not invoice.selected_spoc_id:
        raise HTTPException(status_code=400, detail="Please select SPOC before finalizing")

    pairs = get_invoice_matter_pairs(db, invoice)
    client_name = get_invoice_client_name(db, invoice)

    if invoice.invoice_type in {"PART1", "PART2"}:
        client = db.query(Client).filter(Client.id == invoice.client_id).first()

        spoc = None
        if invoice.selected_spoc_id:
            spoc = db.query(ClientSPOC).filter(
                ClientSPOC.id == invoice.selected_spoc_id
            ).first()

        # map matters
        matters = []
        for m, amount in pairs:
            m.client_share = amount
            matters.append(m)

        path = generate_invoice_docx(
            invoice=invoice,
            client=client,
            spoc=spoc,
            matters=matters
        )
        invoice.generated_docx_path = path
    else:
        pdf_bytes = build_invoice_pdf(invoice)
        path = save_invoice_pdf(invoice, pdf_bytes)
        invoice.generated_pdf_path = path

    invoice.status = "finalized"
    invoice.finalized_at = datetime.utcnow()
    db.add(invoice)
    db.commit()
    db.refresh(invoice)

    return {
        "ok": True,
        "invoice_id": invoice.id,
        "status": invoice.status,
        "is_locked": True,
    }


@router.get("/{invoice_id}/download-docx")
def download_consolidated_docx(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "invoices:view")

    invoice = get_invoice_or_404(db, invoice_id)
    ensure_user_can_access_invoice(db, current_user, invoice)

    if invoice.invoice_type not in {"PART1", "PART2"}:
        raise HTTPException(status_code=400, detail="DOCX available only for consolidated invoices")

    if not invoice.generated_docx_path or not os.path.exists(invoice.generated_docx_path):
        client = db.query(Client).filter(Client.id == invoice.client_id).first()

        spoc = None
        if invoice.selected_spoc_id:
            spoc = db.query(ClientSPOC).filter(
                ClientSPOC.id == invoice.selected_spoc_id
            ).first()

        pairs = get_invoice_matter_pairs(db, invoice)

        matters = []
        for m, amount in pairs:
            m.client_share = amount
            matters.append(m)

        path = generate_invoice_docx(
            invoice=invoice,
            client=client,
            spoc=spoc,
            matters=matters
        )

        invoice.generated_docx_path = path
        db.add(invoice)
        db.commit()
        db.refresh(invoice)

    return FileResponse(
        invoice.generated_docx_path,
        filename=os.path.basename(invoice.generated_docx_path),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )


@router.get("/{invoice_id}/pdf")
def download_invoice_pdf(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "invoices:view")

    invoice = get_invoice_or_404(db, invoice_id)
    ensure_user_can_access_invoice(db, current_user, invoice)

    if invoice.invoice_type in {"PART1", "PART2"}:
        raise HTTPException(status_code=400, detail="Use DOCX download for consolidated invoices")

    if not invoice.generated_pdf_path or not os.path.exists(invoice.generated_pdf_path):
        pdf_bytes = build_invoice_pdf(invoice)
        path = save_invoice_pdf(invoice, pdf_bytes)
        invoice.generated_pdf_path = path
        db.add(invoice)
        db.commit()
        db.refresh(invoice)

    return FileResponse(
        invoice.generated_pdf_path,
        filename=os.path.basename(invoice.generated_pdf_path),
        media_type="application/pdf",
    )


@router.delete("/{invoice_id}")
def delete_invoice(
    invoice_id: int,
    force: bool = Query(False),  # 🔥 ADD THIS
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "invoices:view")

    invoice = get_invoice_or_404(db, invoice_id)
    ensure_user_can_access_invoice(db, current_user, invoice)

    if is_locked(invoice):
        raise HTTPException(status_code=400, detail="Finalized invoice cannot be deleted")

    # 🔥 CHECK NUMBER OF MATTERS
    items = db.query(InvoiceMatter).filter(InvoiceMatter.invoice_id == invoice.id).all()

    if len(items) > 1 and not force:
        raise HTTPException(
            status_code=400,
            detail="This invoice contains multiple matters. Confirm deletion."
        )

    db.query(InvoiceMatter).filter(InvoiceMatter.invoice_id == invoice.id).delete()
    db.query(InvoicePayment).filter(InvoicePayment.invoice_id == invoice.id).delete()

    db.delete(invoice)
    db.commit()

    return {"ok": True}


@router.get("/client-matters/{client_id}")
def get_client_matters(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "invoices:view")
    ensure_user_can_access_client(current_user, client_id)

    query = db.query(Matter).filter(Matter.client_id == client_id)

    role = (current_user.role or "").lower()
    if role == "lawyer":
        query = query.filter(Matter.gnp_lawyer_id == current_user.id)

    matters = query.order_by(Matter.id.desc()).all()

    return [
        {
            "id": matter.id,
            "matter_name": matter.matter_name,
            "case_no": matter.case_no,
            "forum": getattr(matter.forum, "name", None) or "-",
            "part1_done": matter_phase_done(db, matter.id, "PART1"),
            "part2_done": matter_phase_done(db, matter.id, "PART2"),
        }
        for matter in matters
    ]


@router.get("/tracker")
def get_invoice_tracker(
    client_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "invoices:view")

    matter_query = db.query(Matter)

    role = (current_user.role or "").lower()
    if role == "client" and getattr(current_user, "client_id", None):
        matter_query = matter_query.filter(Matter.client_id == current_user.client_id)
    elif role == "lawyer":
        matter_query = matter_query.filter(Matter.gnp_lawyer_id == current_user.id)

    if client_id:
        matter_query = matter_query.filter(Matter.client_id == client_id)

    matters = matter_query.order_by(Matter.id.desc()).all()

    rows = []

    for matter in matters:
        part1 = get_latest_invoice_for_matter(db, matter.id, "PART1")
        part2 = get_latest_invoice_for_matter(db, matter.id, "PART2")

        def build_invoice_data(inv):
            if not inv:
                return None

            payments = db.query(InvoicePayment).filter(
                InvoicePayment.invoice_id == inv.id
            ).all()

            paid_total = sum(float(p.amount or 0) for p in payments)
            total = float(inv.final_total or 0)
            balance = round(total - paid_total, 2)

            status = "Unpaid"
            if paid_total >= total and total > 0:
                status = "Paid"
            elif paid_total > 0:
                status = "Partial"

            return {
                "invoice_id": inv.id,
                "invoice_number": inv.invoice_no,
                "total": total,
                "paid": round(paid_total, 2),
                "balance": balance,
                "status": status,
                "date": (
                    inv.finalized_at.date().isoformat()
                    if inv.finalized_at
                    else inv.created_at.date().isoformat()
                ),
            }

        def build_invoice_block(inv: Optional[Invoice]):
            if not inv:
                return None

            payments = db.query(InvoicePayment).filter(
                InvoicePayment.invoice_id == inv.id
            ).order_by(InvoicePayment.paid_at.desc()).all()

            paid = sum(float(p.amount or 0) for p in payments)
            total = float(inv.final_total or 0)
            balance = round(total - paid, 2)

            # 🔥 STATUS
            if inv.status == "draft":
                status = "Draft"
            elif paid >= total and total > 0:
                status = "Paid"
            elif paid > 0:
                status = "Partial"
            else:
                status = "Unpaid"

            # 🔥 IMPORTANT DATES
            invoice_date = (
                inv.finalized_at.date().isoformat()
                if inv.finalized_at
                else inv.created_at.date().isoformat()
            )

            last_payment_date = (
                payments[0].paid_at.date().isoformat()
                if payments and payments[0].paid_at
                else None
            )

            return {
                "invoice_id": inv.id,
                "invoice_number": inv.invoice_no,

                # ✅ FIXED FIELD NAMES
                "invoice_type": inv.invoice_type,
                "invoice_date": invoice_date,
                "last_payment_date": last_payment_date,

                "total": round(total, 2),
                "paid": round(paid, 2),
                "balance": balance,
                "status": status,
            }


        rows.append(
            {
                "client_name": matter.client.legal_name if matter.client else None,
                "matter_name": matter.matter_name,
                "case_no": matter.case_no,
                "part1": build_invoice_block(part1),
                "part2": build_invoice_block(part2),
            }
        )

    return rows


@router.post("/{invoice_id}/payment")
def record_invoice_payment(
    invoice_id: int,
    amount: float = Form(...),
    payment_mode: Optional[str] = Form(None),
    reference_no: Optional[str] = Form(None),
    remarks: Optional[str] = Form(None),
    file: UploadFile = File(None),  # 🔥 ADD
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "invoices:view")

    invoice = get_invoice_or_404(db, invoice_id)
    ensure_user_can_access_invoice(db, current_user, invoice)

    if amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid payment amount")
    
    if file:
        contents = file.file.read()
        if len(contents) > 5 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File too large (max 5MB)")
        
        file.file.seek(0)  # 🔥 IMPORTANT reset pointer

    # 🔥 FILE SAVE
    file_path = None

    if file:
        invoice_folder_name = (invoice.invoice_no or f"invoice_{invoice.id}").replace("/", "-")

        folder = os.path.join(
            "storage",
            "payments",
            "invoices",
            invoice_folder_name
        )

        os.makedirs(folder, exist_ok=True)

        file_path = os.path.join(folder, f"{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{file.filename}")

        with open(file_path, "wb") as f:
            f.write(file.file.read())

    payment = InvoicePayment(
        invoice_id=invoice.id,
        amount=round(float(amount), 2),
        payment_mode=payment_mode,
        reference_no=reference_no,
        remarks=remarks,
        proof_file=file_path,  # 🔥 SAVE
        entered_by=current_user.id,
    )

    db.add(payment)
    db.commit()

    # 🔥 STATUS UPDATE
    total_paid = sum(
        float(x.amount or 0)
        for x in db.query(InvoicePayment).filter(InvoicePayment.invoice_id == invoice.id).all()
    )

    total_due = float(invoice.final_total or 0)

    if total_paid >= total_due:
        invoice.status = "paid"
    elif total_paid > 0:
        invoice.status = "partial"

    db.add(invoice)
    db.commit()

    return {
        "ok": True,
        "status": invoice.status,
        "paid_total": round(total_paid, 2),
    }

@router.put("/payments/{payment_id}")
def update_payment(
    payment_id: int,
    amount: float = Form(...),
    payment_mode: Optional[str] = Form(None),
    reference_no: Optional[str] = Form(None),
    remarks: Optional[str] = Form(None),
    file: UploadFile = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "invoices:view")

    payment = db.query(InvoicePayment).filter(InvoicePayment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    invoice = get_invoice_or_404(db, payment.invoice_id)
    ensure_user_can_access_invoice(db, current_user, invoice)

    if amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid amount")

    # 🔥 UPDATE VALUES
    payment.amount = round(float(amount), 2)
    payment.payment_mode = payment_mode
    payment.reference_no = reference_no
    payment.remarks = remarks

    # 🔥 FILE UPDATE
    if file:
        invoice_folder_name = (invoice.invoice_no or f"invoice_{invoice.id}").replace("/", "-")

        folder = os.path.join(
            "storage",
            "payments",
            "invoices",
            invoice_folder_name
        )

        os.makedirs(folder, exist_ok=True)

        file_path = os.path.join(
            folder,
            f"{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{file.filename}"
        )

        with open(file_path, "wb") as f:
            f.write(file.file.read())

        payment.proof_file = file_path

    db.commit()

    return {"ok": True}

@router.delete("/payments/{payment_id}")
def delete_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "invoices:view")

    payment = db.query(InvoicePayment).filter(InvoicePayment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    invoice = get_invoice_or_404(db, payment.invoice_id)
    ensure_user_can_access_invoice(db, current_user, invoice)

    db.delete(payment)
    db.commit()

    # 🔥 RECALCULATE INVOICE STATUS
    payments = db.query(InvoicePayment).filter(
        InvoicePayment.invoice_id == invoice.id
    ).all()

    total_paid = sum(float(p.amount or 0) for p in payments)
    total_due = float(invoice.final_total or 0)

    if total_paid == 0:
        invoice.status = "finalized"
    elif total_paid >= total_due:
        invoice.status = "paid"
    else:
        invoice.status = "partial"

    db.commit()

    return {"ok": True}

@router.get("/{invoice_id}/payments")
def get_invoice_payments(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "invoices:view")

    invoice = get_invoice_or_404(db, invoice_id)
    ensure_user_can_access_invoice(db, current_user, invoice)

    payments = db.query(InvoicePayment).filter(
        InvoicePayment.invoice_id == invoice_id
    ).order_by(InvoicePayment.paid_at.desc()).all()

    return [
        {
            "id": p.id,
            "amount": p.amount,
            "payment_mode": p.payment_mode,
            "reference_no": p.reference_no,
            "remarks": p.remarks,
            "proof_file": p.proof_file,
            "date": p.paid_at.isoformat() if p.paid_at else None,
        }
        for p in payments
    ]

@router.get("/aging")
def get_invoice_aging(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "invoices:view")

    query = db.query(Invoice).filter(Invoice.status.in_(["finalized", "partial"]))
    query = apply_invoice_access_filter(query, current_user)

    today = date.today()
    rows = []

    for inv in query.order_by(Invoice.id.desc()).all():
        paid_total = sum(
            float(x.amount or 0)
            for x in db.query(InvoicePayment).filter(InvoicePayment.invoice_id == inv.id).all()
        )
        balance = round(float(inv.final_total or 0) - paid_total, 2)
        basis_date = inv.finalized_at.date() if inv.finalized_at else inv.created_at.date()
        age_days = (today - basis_date).days

        rows.append(
            {
                "invoice_id": inv.id,
                "invoice_number": inv.invoice_no,
                "client": get_invoice_client_name(db, inv),
                "status": status_label_for(inv.status),
                "final_total": round(float(inv.final_total or 0), 2),
                "paid_total": round(paid_total, 2),
                "balance": balance,
                "age_days": age_days,
            }
        )

    return rows

@router.post("/generate")
def generate_invoice_legacy():
    raise HTTPException(status_code=400, detail="Use /invoices/generate-consolidated or /invoices/misc")

@router.get("/payments/file/{path:path}")
def serve_payment_file(path: str):
    # 🔒 SECURITY: restrict to storage folder only
    base_dir = os.path.abspath("storage")
    full_path = os.path.abspath(path)

    if not full_path.startswith(base_dir):
        raise HTTPException(status_code=403, detail="Access denied")

    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(full_path)

@router.get("/dashboard")
def invoice_dashboard(db: Session = Depends(get_db)):
    invoices = db.query(Invoice).all()
    client_invoices = db.query(ClientInvoice).all()
    counsel_invoices = db.query(CounselInvoice).all()

    return {
        "invoices": invoices,
        "client_invoices": client_invoices,
        "counsel_invoices": counsel_invoices,
    }

@router.get("/tracker/export")
def export_invoice_tracker(
    client_id: int = Query(None),
    columns: str = Query(None),
    from_date: str = Query(None),
    to_date: str = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from sqlalchemy.orm import joinedload
    from openpyxl.styles import Font
    from openpyxl.utils import get_column_letter

    # ================= DATE FILTER =================
    start_date = datetime.strptime(from_date, "%Y-%m-%d").date() if from_date else None
    end_date = datetime.strptime(to_date, "%Y-%m-%d").date() if to_date else None

    # ================= QUERY =================
    query = (
        db.query(Matter)
        .options(joinedload(Matter.client))
        .filter(Matter.is_deleted == False)
    )

    if client_id:
        query = query.filter(Matter.client_id == client_id)

    matters = query.all()

    # ================= HELPER =================
    def get_invoice_data(matter_id, inv_type):
        inv = get_latest_invoice_for_matter(db, matter_id, inv_type)

        if not inv:
            return None

        inv_date = inv.finalized_at.date() if inv.finalized_at else inv.created_at.date()

        if start_date and inv_date < start_date:
            return None
        if end_date and inv_date > end_date:
            return None

        payments = db.query(InvoicePayment).filter(
            InvoicePayment.invoice_id == inv.id
        ).order_by(InvoicePayment.paid_at.desc()).all()

        paid = sum(float(p.amount or 0) for p in payments)
        total = float(inv.final_total or 0)

        return {
            "invoice_no": inv.invoice_no,
            "invoice_date": inv_date.strftime("%d-%m-%Y"),

            # 🔥 NEW
            "last_payment_date": (
                payments[0].paid_at.strftime("%d-%m-%Y")
                if payments and payments[0].paid_at
                else ""
            ),

            "total": total,
            "paid": paid,
            "pending": round(total - paid, 2),
        }
        inv = get_latest_invoice_for_matter(db, matter_id, inv_type)

        if not inv:
            return None

        inv_date = inv.finalized_at.date() if inv.finalized_at else inv.created_at.date()

        if start_date and inv_date < start_date:
            return None
        if end_date and inv_date > end_date:
            return None

        payments = db.query(InvoicePayment).filter(
            InvoicePayment.invoice_id == inv.id
        ).all()

        paid = sum(float(p.amount or 0) for p in payments)
        total = float(inv.final_total or 0)

        return {
            "invoice_no": inv.invoice_no,
            "total": total,
            "paid": paid,
            "pending": round(total - paid, 2),
        }

    # ================= COLUMN CONFIG =================
    COLUMN_MAP = {
        "client": ("Client", lambda m: m.client.legal_name if m.client else ""),
        "matter": ("Matter", lambda m: m.matter_name),
        "case_no": ("Case No", lambda m: m.case_no),

        # 🔥 INVOICE IDENTIFIERS
        "part1": ("Part-1 Invoice", lambda m: (get_invoice_data(m.id, "PART1") or {}).get("invoice_no", "")),
        "part2": ("Part-2 Invoice", lambda m: (get_invoice_data(m.id, "PART2") or {}).get("invoice_no", "")),

        # 🔥 NEW: INVOICE DATE
        "invoice_date": (
            "Invoice Date",
            lambda m: (
                (get_invoice_data(m.id, "PART2") or {}).get("invoice_date")
                or (get_invoice_data(m.id, "PART1") or {}).get("invoice_date")
            )
        ),

        # 🔥 NEW: LAST PAYMENT DATE
        "payment_date": (
            "Last Payment Date",
            lambda m: (
                (get_invoice_data(m.id, "PART2") or {}).get("last_payment_date")
                or (get_invoice_data(m.id, "PART1") or {}).get("last_payment_date")
            )
        ),

        # 🔥 AMOUNTS
        "total": ("Invoice Amount", lambda m: sum([
            (get_invoice_data(m.id, "PART1") or {}).get("total", 0),
            (get_invoice_data(m.id, "PART2") or {}).get("total", 0),
        ])),

        "paid": ("Paid Amount", lambda m: sum([
            (get_invoice_data(m.id, "PART1") or {}).get("paid", 0),
            (get_invoice_data(m.id, "PART2") or {}).get("paid", 0),
        ])),

        "pending": ("Pending Amount", lambda m: sum([
            (get_invoice_data(m.id, "PART1") or {}).get("pending", 0),
            (get_invoice_data(m.id, "PART2") or {}).get("pending", 0),
        ])),

        "status": ("Status", lambda m: m.current_status),
    }

    DEFAULT_COLUMNS = ["client", "matter", "case_no", "part1", "part2", "invoice_date", "payment_date", "total", "paid", "pending"]

    # ✅ FIXED COLUMN HANDLING
    selected_cols = columns.split(",") if columns else DEFAULT_COLUMNS
    selected_cols = [c for c in selected_cols if c in COLUMN_MAP]

    # ================= BUILD DATA =================
    rows = []

    for m in matters:
        row_data = {}

        for col in selected_cols:
            label, fn = COLUMN_MAP[col]
            row_data[label] = fn(m)

        rows.append(row_data)

    df = pd.DataFrame(rows)

    # ================= EXCEL =================
    output = BytesIO()

    today_str = datetime.now().strftime("%d %B %Y")

    if client_id:
        client = db.query(Client).filter(Client.id == client_id).first()
        title = f"Invoice Tracker for {client.legal_name} as on {today_str}"
    else:
        title = f"Invoice Tracker for All Clients as on {today_str}"

    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, startrow=2)

        sheet = writer.sheets["Sheet1"]

        # Title
        sheet["A1"] = title
        sheet["A1"].font = Font(bold=True)

        # Header styling
        for cell in sheet[3]:
            cell.font = Font(bold=True)

        # Auto width
        for col in sheet.columns:
            max_length = 0
            col_letter = col[0].column_letter

            for cell in col:
                if cell.value:
                    max_length = max(max_length, len(str(cell.value)))

            sheet.column_dimensions[col_letter].width = min(max_length + 2, 30)

        # FILTER FIX
        last_col = get_column_letter(len(df.columns))
        last_row = len(df) + 3

        sheet.auto_filter.ref = f"A3:{last_col}{last_row}"

    output.seek(0)

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": "attachment; filename=invoice_tracker.xlsx"
        },
    )