from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class Client(Base):
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, unique=True, index=True)

    legal_name = Column(String, nullable=False, index=True)
    client_type = Column(String, nullable=True)

    registered_address = Column(Text, nullable=True)
    corporate_address = Column(Text, nullable=True)
    billing_address = Column(Text, nullable=True)

    pan = Column(String, nullable=True, unique=True, index=True)
    pan_file_path = Column(String, nullable=True)

    contact_name = Column(String, nullable=True)
    designation = Column(String, nullable=True)

    accounts_name = Column(String, nullable=True)
    accounts_email = Column(String, nullable=True, index=True)
    accounts_mobile = Column(String, nullable=True)

    reference = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="clients", lazy="joined")

    matters = relationship(
        "Matter",
        back_populates="client",
        cascade="all, delete-orphan",
        lazy="select",
    )

    spocs = relationship(
        "ClientSPOC",
        back_populates="client",
        cascade="all, delete-orphan",
        lazy="select",
    )

    def primary_spoc(self):
        return self.spocs[0] if self.spocs else None

    def to_dict(self):
        return {
            "id": self.id,
            "legal_name": self.legal_name,
            "client_type": self.client_type,
            "contact_name": self.contact_name,
            "designation": self.designation,
            "accounts_email": self.accounts_email,
            "accounts_mobile": self.accounts_mobile,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }