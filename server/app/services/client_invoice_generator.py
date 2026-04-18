from datetime import datetime
import os

from sqlalchemy.orm import Session

from app.models.client_invoice import ClientInvoice
from app.models.matter import Matter
from app.utils.file_utils import get_relative_path
import uuid

# ================= PART 1 INVOICE =================

def generate_part1_invoice(db: Session, matter: Matter):
    invoice = db.query(ClientInvoice).filter(
        ClientInvoice.matter_id == matter.id
    ).first()

    if not invoice or invoice.part1_file:
        return

    try:
        amount = (matter.claim_amount or 0) * 0.5

        file_path = _generate_invoice_file(
            matter=matter,
            invoice_type="part1",
            amount=amount
        )

        invoice.part1_fee = amount
        invoice.total_fee = (invoice.part1_fee or 0) + (invoice.part2_fee or 0)
        invoice.part1_file = file_path

        db.commit()
        db.refresh(invoice)

    except Exception as e:
        db.rollback()
        print("❌ PART1 INVOICE ERROR:", str(e))
        raise


# ================= PART 2 INVOICE =================

def generate_part2_invoice(db: Session, matter: Matter):
    invoice = db.query(ClientInvoice).filter(
        ClientInvoice.matter_id == matter.id
    ).first()

    if not invoice or invoice.part2_file:
        return

    try:
        amount = (matter.claim_amount or 0) * 0.5

        file_path = _generate_invoice_file(
            matter=matter,
            invoice_type="part2",
            amount=amount
        )

        invoice.part2_fee = amount
        invoice.total_fee = (invoice.part1_fee or 0) + (invoice.part2_fee or 0)
        invoice.part2_file = file_path

        db.commit()
        db.refresh(invoice)

    except Exception as e:
        db.rollback()
        print("❌ PART2 INVOICE ERROR:", str(e))
        raise
    """
    Triggered when matter is disposed
    """

    invoice = db.query(ClientInvoice).filter(
        ClientInvoice.matter_id == matter.id
    ).first()

    if not invoice:
        return

    # Avoid duplicate
    if invoice.part2_file:
        return

    amount = (matter.claim_amount or 0) * 0.5

    invoice.part2_fee = amount
    invoice.total_fee = (invoice.part1_fee or 0) + (invoice.part2_fee or 0)

    file_path = _generate_invoice_file(
        matter=matter,
        invoice_type="part2",
        amount=amount
    )

    invoice.part2_file = file_path

    db.commit()
    db.refresh(invoice)


# ================= FILE GENERATOR =================

def _generate_invoice_file(matter: Matter, invoice_type: str, amount: float):
    """
    For now → creates a simple text file
    Later → replace with PDF/DOCX
    """

    client_name = matter.client.legal_name.replace(" ", "_")
    matter_name = matter.matter_name.replace(" ", "_")

    folder = os.path.join(
        "storage",
        client_name,
        matter_name,
        "client_invoices"
    )

    os.makedirs(folder, exist_ok=True)

    filename = f"{invoice_type.upper()}_{uuid.uuid4().hex}.txt"
    full_path = os.path.join(folder, filename)

    with open(full_path, "w") as f:
        f.write(f"Invoice Type: {invoice_type}\n")
        f.write(f"Matter: {matter.matter_name}\n")
        f.write(f"Amount: {amount}\n")

    return get_relative_path(full_path)


# ================= (LEGACY / OPTIONAL) =================

def generate_client_invoice(
    db: Session,
    client_id: int,
    matter_ids: list[int],
):
    """
    NOT USED in your current system
    Keeping for future bulk invoice feature
    """

    matters = db.query(Matter).filter(Matter.id.in_(matter_ids)).all()

    if not matters:
        raise ValueError("No valid matters found")

    invoice = ClientInvoice(
        client_id=client_id,
        total_fee=0,
        part1_fee=0,
        part2_fee=0,
        miscellaneous_fee=0
    )

    db.add(invoice)
    db.commit()
    db.refresh(invoice)

    return invoice