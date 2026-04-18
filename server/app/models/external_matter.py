from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Date, Numeric
from sqlalchemy.orm import relationship
from app.database import Base


class ExternalMatter(Base):
    __tablename__ = "external_matters"

    id = Column(Integer, primary_key=True, index=True)

    # ================= RAW DATA =================
    client_name = Column(String, nullable=False, index=True)
    matter_name = Column(String, nullable=False)
    case_no = Column(String, nullable=False, index=True)

    forum = Column(String, nullable=True, index=True)
    state = Column(String, nullable=True, index=True)
    district = Column(String, nullable=True, index=True)

    claim_amount = Column(Numeric(12, 2), nullable=True)

    status = Column(String, nullable=True, index=True)

    ldoh = Column(Date, nullable=True, index=True)
    ndoh = Column(Date, nullable=True, index=True)

    purpose = Column(String, nullable=True)
    lawyer_name = Column(String, nullable=True)

    # ================= SYSTEM LINKING =================
    linked_matter_id = Column(Integer, ForeignKey("matters.id"), nullable=True, index=True)
    counsel_id = Column(Integer, ForeignKey("local_counsels.id"), nullable=True, index=True)

    # ================= FILE TRACKING =================
    source_file = Column(String, nullable=True, index=True)

    # ================= META =================
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # ================= RELATIONSHIPS =================
    linked_matter = relationship("Matter")
    counsel = relationship("LocalCounsel")

    # ================= HELPERS =================
    def to_dict(self):
        return {
            "id": self.id,
            "client_name": self.client_name,
            "matter_name": self.matter_name,
            "case_no": self.case_no,
            "forum": self.forum,
            "state": self.state,
            "district": self.district,
            "claim_amount": float(self.claim_amount or 0) if self.claim_amount else None,
            "status": self.status,
            "ldoh": self.ldoh.isoformat() if self.ldoh else None,
            "ndoh": self.ndoh.isoformat() if self.ndoh else None,
            "purpose": self.purpose,
            "lawyer_name": self.lawyer_name,
            "linked_matter_id": self.linked_matter_id,
            "counsel_id": self.counsel_id,
            "counsel_name": self.counsel.name if self.counsel else None,
            "counsel_phone": self.counsel.phone if self.counsel else None,
            "source_file": self.source_file,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }