from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.client_invoice import ClientInvoice
from app.models.counsel_invoice import CounselInvoice


# ================= CLIENT INVOICE NUMBER =================

def generate_client_invoice_number(db: Session) -> str:
    """
    Format: GNP-CLI-2026-0001
    """

    year = datetime.utcnow().year

    count = (
        db.query(func.count(ClientInvoice.id))
        .scalar()
    ) or 0

    next_no = count + 1

    return f"GNP-CLI-{year}-{str(next_no).zfill(4)}"


# ================= COUNSEL INVOICE NUMBER =================

def generate_counsel_invoice_number(db: Session) -> str:
    """
    Format: GNP-CNS-2026-0001
    """

    year = datetime.utcnow().year

    count = (
        db.query(func.count(CounselInvoice.id))
        .scalar()
    ) or 0

    next_no = count + 1

    return f"GNP-CNS-{year}-{str(next_no).zfill(4)}"


# ================= LEGACY SUPPORT =================

def generate_invoice_number(db: Session) -> str:
    """
    ⚠️ LEGACY - do not use in new system
    """
    year = datetime.utcnow().year

    count = (
        db.query(func.count(ClientInvoice.id))
        .scalar()
    ) or 0

    next_no = count + 1

    return f"GNP-INV-{year}-{str(next_no).zfill(4)}"