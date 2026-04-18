from sqlalchemy import Column, Integer, String, DateTime
from datetime import datetime
from app.database import Base

class MISConfig(Base):
    __tablename__ = "mis_config"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, nullable=False)
    value = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)