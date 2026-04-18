from datetime import datetime
from sqlalchemy import Column, Integer, Date, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class HearingDateUpdate(Base):
    __tablename__ = "hearing_date_updates"

    id = Column(Integer, primary_key=True, index=True)

    # 🔗 RELATIONS
    matter_id = Column(Integer, ForeignKey("matters.id"), nullable=False, index=True)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    # 🔥 DATE TRACKING
    old_ldoh = Column(Date, nullable=True)
    new_ldoh = Column(Date, nullable=True)

    old_ndoh = Column(Date, nullable=True)
    new_ndoh = Column(Date, nullable=True)

    # 📅 META
    created_at = Column(DateTime, default=datetime.utcnow)

    # ================= RELATIONSHIPS =================

    matter = relationship("Matter")
    user = relationship("User")

    # ================= HELPERS =================

    def to_dict(self):
        return {
            "id": self.id,
            "matter_id": self.matter_id,

            "old_ldoh": self.old_ldoh.isoformat() if self.old_ldoh else None,
            "new_ldoh": self.new_ldoh.isoformat() if self.new_ldoh else None,

            "old_ndoh": self.old_ndoh.isoformat() if self.old_ndoh else None,
            "new_ndoh": self.new_ndoh.isoformat() if self.new_ndoh else None,

            # 🔥 FIX (frontend consistency)
            "updated_by_id": self.updated_by,
            "updated_by_name": self.user.full_name if self.user else None,

            "created_at": self.created_at.isoformat() if self.created_at else None,
        }