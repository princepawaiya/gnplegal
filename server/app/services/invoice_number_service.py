from datetime import datetime
from sqlalchemy.orm import Session

from app.models.invoice import Invoice


def generate_invoice_number(db: Session) -> str:
    """
    Format: INV/YYYY/MM/0001
    Example: INV/2026/04/0001
    """

    now = datetime.utcnow()
    year = now.year
    month = str(now.month).zfill(2)

    prefix = f"INV/{year}/{month}/"

    # Get last invoice for this month
    last_invoice = (
        db.query(Invoice)
        .filter(Invoice.invoice_no.like(f"{prefix}%"))
        .order_by(Invoice.id.desc())
        .first()
    )

    if last_invoice and last_invoice.invoice_no:
        try:
            last_seq = int(last_invoice.invoice_no.split("/")[-1])
        except:
            last_seq = 0
    else:
        last_seq = 0

    next_seq = last_seq + 1

    return f"{prefix}{str(next_seq).zfill(4)}"