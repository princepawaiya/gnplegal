from sqlalchemy import Column, Integer, ForeignKey, Float
from sqlalchemy.orm import relationship
from app.database import Base


class InvoiceMatter(Base):
    __tablename__ = "invoice_matters"

    id = Column(Integer, primary_key=True, index=True)

    # 🔗 RELATIONS
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False, index=True)
    matter_id = Column(Integer, ForeignKey("matters.id"), nullable=False, index=True)

    # 💰 AMOUNT
    amount = Column(Float, default=0)

    # ================= RELATIONSHIPS =================

    invoice = relationship("Invoice", back_populates="matters")
    matter = relationship("Matter")

    # ================= HELPERS =================

    def to_dict(self):
        return {
            "id": self.id,
            "invoice_id": self.invoice_id,
            "matter_id": self.matter_id,
            "amount": self.amount,
        }