from sqlalchemy import Column, Integer, String
from app.database import Base


class Permission(Base):
    __tablename__ = "permissions"

    id = Column(Integer, primary_key=True, index=True)

    # Unique permission code (used in system)
    code = Column(String, unique=True, nullable=False, index=True)

    # Human-readable label
    label = Column(String, nullable=False)

    # Optional grouping (UI usage)
    group_name = Column(String, nullable=True)

    # ================= HELPERS =================

    def to_dict(self):
        return {
            "id": self.id,
            "code": self.code,
            "label": self.label,
            "group_name": self.group_name,
        }