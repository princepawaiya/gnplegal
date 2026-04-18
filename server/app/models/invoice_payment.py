from sqlalchemy import Column, Integer, Float, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class InvoicePayment(Base):
    __tablename__ = "invoice_payments"

    id = Column(Integer, primary_key=True, index=True)

    # 🔥 LINK TO INVOICE (CRITICAL)
    invoice_id = Column(
        Integer,
        ForeignKey("invoices.id"),
        nullable=False,
        index=True
    )

    # 💰 PAYMENT DETAILS
    amount = Column(Float, default=0)
    payment_mode = Column(String, nullable=True)
    reference_no = Column(String, nullable=True)
    remarks = Column(String, nullable=True)

    # 📎 FILE PROOF
    proof_file = Column(String, nullable=True)

    # 👤 USER TRACKING
    entered_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    paid_at = Column(DateTime, default=datetime.utcnow)

    # 🔗 RELATIONSHIPS
    invoice = relationship("Invoice", back_populates="payments")
    user = relationship("User")