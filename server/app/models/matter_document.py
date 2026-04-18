from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base
from app.utils.file_utils import build_file_url


class MatterDocument(Base):
    __tablename__ = "matter_documents"

    id = Column(Integer, primary_key=True, index=True)

    # 🔗 RELATIONS
    matter_id = Column(Integer, ForeignKey("matters.id"), nullable=False, index=True)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    # 📄 DOCUMENT DETAILS
    file_name = Column(String, nullable=True)
    file_path = Column(String, nullable=False)

    document_type = Column(String, nullable=True, index=True)
    description = Column(Text, nullable=True)

    # 📅 META
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    # ================= RELATIONSHIPS =================

    matter = relationship("Matter", back_populates="documents")
    uploader = relationship("User")

    # ================= HELPERS =================

    def to_dict(self):
        return {
            "id": self.id,
            "matter_id": self.matter_id,
            "file_name": self.file_name,
            "file_url": build_file_url(self.file_path),  # ✅ FIXED
            "document_type": self.document_type,
            "description": self.description,
            "uploaded_by": self.uploaded_by,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }