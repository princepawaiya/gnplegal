from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Numeric
from sqlalchemy.orm import relationship
from app.database import Base


class CounselInvoice(Base):
    __tablename__ = "counsel_invoices"

    id = Column(Integer, primary_key=True, index=True)

    # 🔗 RELATION (ONE RECORD PER MATTER)
    matter_id = Column(Integer, ForeignKey("matters.id"), nullable=False, unique=True, index=True)

    # optional, for filtering / reporting
    counsel_id = Column(Integer, ForeignKey("local_counsels.id"), nullable=True, index=True)

    # 💰 FEES
    total_fee = Column(Numeric(12, 2), default=0)
    part1_fee = Column(Numeric(12, 2), default=0)
    part2_fee = Column(Numeric(12, 2), default=0)
    miscellaneous_fee = Column(Numeric(12, 2), default=0)

    # 📄 FILES
    part1_file = Column(String, nullable=True)
    part2_file = Column(String, nullable=True)
    miscellaneous_file = Column(String, nullable=True)

    # 📅 META
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # ================= RELATIONSHIPS =================
    matter = relationship("Matter")
    counsel = relationship("LocalCounsel")

    # ================= HELPERS =================
    def to_dict(self):
        return {
            "id": self.id,
            "matter_id": self.matter_id,
            "counsel_id": self.counsel_id,
            "total_fee": float(self.total_fee or 0),
            "part1_fee": float(self.part1_fee or 0),
            "part2_fee": float(self.part2_fee or 0),
            "miscellaneous_fee": float(self.miscellaneous_fee or 0),
            "part1_file": self.part1_file,
            "part2_file": self.part2_file,
            "miscellaneous_file": self.miscellaneous_file,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }