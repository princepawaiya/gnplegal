from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class ClientSPOC(Base):
    __tablename__ = "client_spocs"

    id = Column(Integer, primary_key=True, index=True)

    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False, index=True)

    name = Column(String, nullable=False)
    email = Column(String, nullable=True, index=True)
    mobile = Column(String, nullable=True)

    is_primary = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    client = relationship("Client", back_populates="spocs")