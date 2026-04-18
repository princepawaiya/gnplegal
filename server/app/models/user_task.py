from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Text
from datetime import datetime
from app.database import Base


class UserTask(Base):
    __tablename__ = "user_tasks"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String, default="pending")
    is_auto = Column(Boolean, default=False)
    source_type = Column(String, nullable=True)   # hearing / invoice / case
    source_id = Column(Integer, nullable=True)    # matter_id / invoice_id
    priority = Column(String, default="normal")   # low / normal / high / critical
    due_date = Column(DateTime, nullable=True)
    linked_matter_id = Column(Integer, ForeignKey("matters.id"), nullable=True)
    linked_hearing_date = Column(DateTime, nullable=True)
    priority_auto_rules = Column(String, nullable=True)  
    created_at = Column(DateTime, default=datetime.utcnow)