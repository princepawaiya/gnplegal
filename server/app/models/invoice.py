from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)

    invoice_no = Column(String, unique=True, index=True, nullable=True)

    client_id = Column(Integer, ForeignKey("clients.id"), nullable=True)

    # PART1 | PART2 | MISC
    invoice_type = Column(String, nullable=True)

    # draft | finalized | paid | partial
    status = Column(String, default="draft")

    subtotal = Column(Float, default=0)
    tax = Column(Float, default=0)
    final_total = Column(Float, default=0)

    notes = Column(Text, nullable=True)

    generated_pdf_path = Column(String, nullable=True)
    generated_docx_path = Column(String, nullable=True)

    selected_spoc_id = Column(Integer, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    finalized_at = Column(DateTime, nullable=True)

    # 🔗 RELATIONS
    client = relationship("Client")

    # 🔥 PAYMENT RELATION (IMPORTANT)
    payments = relationship(
        "InvoicePayment",
        back_populates="invoice",
        cascade="all, delete-orphan"
    )

    # 🔥 MATTER MAPPING (CONSOLIDATED SUPPORT)
    matters = relationship(
        "InvoiceMatter",
        back_populates="invoice",
        cascade="all, delete-orphan"
    )