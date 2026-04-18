from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Date, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from app.database import Base


class HearingStage(Base):
    __tablename__ = "hearing_stage"

    id = Column(Integer, primary_key=True, index=True)
    matter_id = Column(Integer, ForeignKey("matters.id"), nullable=False, index=True)

    # ✅ aligned to frontend + routes
    old_ndoh = Column(Date, nullable=True)
    new_ndoh = Column(Date, nullable=True)
    comment = Column(Text, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    is_edited = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # optional compatibility fields
    hearing_date = Column(Date, nullable=True)
    stage_type = Column(String, nullable=True)
    status = Column(String, nullable=True)
    remarks = Column(Text, nullable=True)
    next_hearing_date = Column(Date, nullable=True)

    matter = relationship("Matter")
    user = relationship("User")