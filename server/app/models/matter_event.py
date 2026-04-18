from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base


class MatterEvent(Base):
    __tablename__ = "matter_events"

    id = Column(Integer, primary_key=True, index=True)

    matter_id = Column(Integer, ForeignKey("matters.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    event_type = Column(String, nullable=False, index=True)
    title = Column(String, nullable=True)
    description = Column(Text, nullable=True)

    old_value = Column(String, nullable=True)
    new_value = Column(String, nullable=True)

    event_date = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    # ================= RELATIONSHIPS =================
    matter = relationship("Matter")
    user = relationship("User")

    # ================= HELPERS =================
    def to_dict(self):
        return {
            "id": self.id,
            "matter_id": self.matter_id,
            "event_type": self.event_type,
            "title": self.title,
            "description": self.description,
            "old_value": self.old_value,
            "new_value": self.new_value,
            "event_date": self.event_date.isoformat() if self.event_date else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "user_id": self.user_id,
            "user_name": self.user.full_name if self.user else None,
        }