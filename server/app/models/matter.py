from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Date, Text, Boolean, Numeric, Float, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class Matter(Base):
    __tablename__ = "matters"
    __table_args__ = (
        UniqueConstraint("client_id", "forum_id", "case_no", name="uq_client_forum_case"),
    )

    id = Column(Integer, primary_key=True, index=True)

    # ================= CORE LINKS =================
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False, index=True)
    forum_id = Column(Integer, ForeignKey("forums.id"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True, index=True)

    # ================= IDENTIFIERS =================
    matter_name = Column(String, nullable=False, index=True)
    case_no = Column(String, nullable=True, index=True)
    internal_case_no = Column(String, unique=True, index=True)

    dc_sc_no = Column(String, nullable=True)

    # ================= DATES =================
    allocation_date = Column(Date, nullable=True)

    ndoh = Column(Date, nullable=True, index=True)
    ldoh = Column(Date, nullable=True, index=True)
    reply_filed_date = Column(Date, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    # ================= CASE DETAILS =================
    summary = Column(Text, nullable=True)
    allegation = Column(Text, nullable=True)

    claim_amount = Column(Numeric(12, 2), default=0)

    current_status = Column(String, default="Pending", index=True)
    current_stage = Column(String, nullable=True)

    pleadings_status = Column(String, nullable=True)

    comments = Column(Text, nullable=True)

    # ================= OUTCOME =================
    outcome = Column(String, nullable=True)
    client_share = Column(Numeric(12, 2), default=0)
    client_savings = Column(Numeric(12, 2), default=0)

    # ================= DISPOSAL =================
    is_active = Column(Boolean, default=True, index=True)
    is_disposed = Column(Boolean, default=False, index=True)
    is_deleted = Column(Boolean, default=False, index=True)   # ADD THIS
    order_date = Column(Date, nullable=True)
    order_file = Column(String, nullable=True)

    # ================= COUNSEL =================
    gnp_lawyer_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    # ================= RELATIONSHIPS =================

    client = relationship("Client", back_populates="matters", lazy="joined")

    forum = relationship("Forum", lazy="joined")

    product = relationship("Product", back_populates="matters", lazy="joined")

    gnp_lawyer = relationship("User", foreign_keys=[gnp_lawyer_id], lazy="joined")

    local_counsels = relationship(
        "LocalCounsel",
        secondary="matter_local_counsel",
        overlaps="assignments,counsel"
    )

    counsel_assignments = relationship(
        "MatterLocalCounsel",
        back_populates="matter",
        overlaps="local_counsels,counsel"
    )

    documents = relationship(
        "MatterDocument",
        back_populates="matter",
        cascade="all, delete-orphan",
        lazy="select",
    )

    # ================= HELPERS =================

    def is_pending(self):
        return (self.current_status or "").strip().lower() == "pending"

    def is_closed(self):
        return (self.is_disposed or 0) == 1

    def claim_bucket(self):
        if (self.claim_amount or 0) > 500000:
            return "Above 500000"
        return "Upto 500000"

    def to_dict(self):
        return {
            "id": self.id,
            "matter_name": self.matter_name,
            "case_no": self.case_no,
            "internal_case_no": self.internal_case_no,
            "client": self.client.legal_name if self.client else None,
            "forum": self.forum.name if self.forum else None,
            "product": self.product.name if self.product else None,
            "claim_amount": self.claim_amount,
            "status": self.current_status,
            "stage": self.current_stage,
            "ldoh": self.ldoh.isoformat() if self.ldoh else None,
            "ndoh": self.ndoh.isoformat() if self.ndoh else None,
            "is_disposed": bool(self.is_disposed),
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }