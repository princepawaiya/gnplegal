from sqlalchemy import Column, Integer, String, DateTime
from datetime import datetime
from app.database import Base


class KnowledgeDocument(Base):
    __tablename__ = "knowledge_documents"

    id = Column(Integer, primary_key=True, index=True)

    title = Column(String, nullable=False)

    doc_type = Column(String, nullable=False)  # bare_act / judgement / template

    file_path = Column(String, nullable=True)

    # ✅ NEW
    category_name = Column(String, nullable=True)
    sub_category_name = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)