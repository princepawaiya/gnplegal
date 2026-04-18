from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Numeric
from sqlalchemy.orm import relationship
from app.database import Base


class CounselPayment(Base):
    __tablename__ = "counsel_payments"

    id = Column(Integer, primary_key=True, index=True)

    # 🔗 RELATION (ONE RECORD PER MATTER)
    matter_id = Column(Integer, ForeignKey("matters.id"), nullable=False, unique=True, index=True)

    # ================= PART PAYMENTS =================

    # 🔹 PART 1
    part1_paid = Column(Numeric(12, 2), default=0)
    part1_paid_at = Column(DateTime, nullable=True)
    part1_file = Column(String, nullable=True)

    # 🔹 PART 2
    part2_paid = Column(Numeric(12, 2), default=0)
    part2_paid_at = Column(DateTime, nullable=True)
    part2_file = Column(String, nullable=True)

    # 🔹 MISC
    miscellaneous_paid = Column(Numeric(12, 2), default=0)
    miscellaneous_paid_at = Column(DateTime, nullable=True)
    miscellaneous_file = Column(String, nullable=True)

    # 🔹 TOTAL
    total_payment = Column(Numeric(12, 2), default=0)

    # 📅 META
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # ================= RELATIONSHIPS =================
    matter = relationship("Matter")

    # ================= HELPERS =================
    def to_dict(self):
        return {
            "id": self.id,
            "matter_id": self.matter_id,
            "part1_paid": float(self.part1_paid or 0),
            "part1_paid_at": self.part1_paid_at.isoformat() if self.part1_paid_at else None,
            "part1_file": self.part1_file,
            "part2_paid": float(self.part2_paid or 0),
            "part2_paid_at": self.part2_paid_at.isoformat() if self.part2_paid_at else None,
            "part2_file": self.part2_file,
            "miscellaneous_paid": float(self.miscellaneous_paid or 0),
            "miscellaneous_paid_at": self.miscellaneous_paid_at.isoformat() if self.miscellaneous_paid_at else None,
            "miscellaneous_file": self.miscellaneous_file,
            "total_payment": float(self.total_payment or 0),
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }