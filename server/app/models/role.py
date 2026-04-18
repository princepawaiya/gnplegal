import json
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean
from sqlalchemy.orm import relationship
from app.database import Base


class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(String, unique=True, nullable=False, index=True)
    description = Column(String, nullable=True)

    permissions = Column(Text, nullable=True)

    is_active = Column(Boolean, default=True, index=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Reverse relationship
    users = relationship("User", back_populates="role_obj", lazy="select")

    # ================= PERMISSIONS =================

    def get_permissions(self):
        try:
            if not self.permissions:
                return []

            if isinstance(self.permissions, list):
                return self.permissions

            parsed = json.loads(self.permissions)

            if isinstance(parsed, list):
                return parsed

            return []
        except Exception:
            return []

    def set_permissions(self, perms):
        try:
            if not isinstance(perms, list):
                perms = []
            self.permissions = json.dumps(perms)
        except Exception:
            self.permissions = "[]"

    def has_permission(self, permission: str) -> bool:
        perms = self.get_permissions()

        if "*" in perms:
            return True

        return permission in perms

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "permissions": self.get_permissions(),
        }