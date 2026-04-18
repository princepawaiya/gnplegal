from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Text
from sqlalchemy.orm import relationship
from app.database import Base


class LocalCounsel(Base):
    __tablename__ = "local_counsels"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    # ================= BASIC =================
    name = Column(String, nullable=False, index=True)
    email = Column(String, nullable=True, index=True)
    phone = Column(String, nullable=True)
    alternate_phone = Column(String, nullable=True)

    city = Column(String, nullable=True, index=True)
    state = Column(String, nullable=True, index=True)
    postal_address = Column(Text, nullable=True)

    # ================= PROFESSIONAL =================
    bar_registration_no = Column(String, nullable=True)
    pan_no = Column(String, nullable=True)
    pan_file_path = Column(String, nullable=True)
    bar_certificate_path = Column(String, nullable=True)

    # ================= PAYMENT =================
    upi_details = Column(String, nullable=True)

    # ================= META =================
    reference = Column(String, nullable=True)
    type = Column(String, nullable=True, default="location")  # location / empanelled / external

    is_approved = Column(Boolean, default=False, index=True)

    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    # ================= RELATIONSHIPS =================

    assignments = relationship(
        "MatterLocalCounsel",
        back_populates="counsel",
        overlaps="matters,local_counsels"
    )

    # ================= HELPERS =================

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "phone": self.phone,
            "city": self.city,
            "state": self.state,
            "type": self.type,
            "is_approved": self.is_approved,
        }


class MatterLocalCounsel(Base):
    __tablename__ = "matter_local_counsel"

    id = Column(Integer, primary_key=True, index=True)

    matter_id = Column(Integer, ForeignKey("matters.id"), nullable=False, index=True)
    local_counsel_id = Column(Integer, ForeignKey("local_counsels.id"), nullable=False, index=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    # ================= RELATIONSHIPS =================

    counsel = relationship(
        "LocalCounsel",
        back_populates="assignments",
        overlaps="matters,local_counsels"
    )

    matter = relationship(
        "Matter",
        back_populates="counsel_assignments",
        overlaps="local_counsels,assignments"
    )

    # ================= HELPERS =================

    def to_dict(self):
        return {
            "id": self.id,
            "matter_id": self.matter_id,
            "counsel_id": self.local_counsel_id,
            "counsel_name": self.counsel.name if self.counsel else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }