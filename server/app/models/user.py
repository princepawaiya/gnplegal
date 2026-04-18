import json
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    full_name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)

    role = Column(String, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)

    is_approved = Column(Boolean, default=True, nullable=False)
    is_active = Column(Boolean, default=True, index=True)

    role_id = Column(Integer, ForeignKey("roles.id"), nullable=True, index=True)
    role_obj = relationship("Role", lazy="joined")

    permissions = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    is_deleted = Column(Boolean, default=False)
    deleted_at = Column(DateTime, nullable=True)
    deleted_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    # ================= RELATIONSHIPS =================
    clients = relationship("Client", back_populates="user")

    assigned_matters = relationship(
        "Matter",
        foreign_keys="Matter.gnp_lawyer_id",
        back_populates="gnp_lawyer"
    )

    # ================= PERMISSIONS =================

    def get_user_permissions(self):
        try:
            data = json.loads(self.permissions) if self.permissions else []
            return data if isinstance(data, list) else []
        except Exception:
            return []

    def get_role_permissions(self):
        try:
            if self.role_obj:
                return self.role_obj.get_permissions() or []
            return []
        except Exception:
            return []

    def get_permissions(self):
        role_perms = self.get_role_permissions()
        user_perms = self.get_user_permissions()
        return list(set((role_perms or []) + (user_perms or [])))

    def has_permission(self, permission: str) -> bool:
        if (self.role or "").strip().lower() == "admin":
            return True

        permissions = self.get_permissions()

        if "*" in permissions:
            return True

        return permission in permissions

    # ================= HELPERS =================

    @property
    def client_id(self):
        if self.clients:
            return sorted(self.clients, key=lambda x: x.id)[0].id
        return None

    def to_dict(self):
        return {
            "id": self.id,
            "full_name": self.full_name,
            "email": self.email,
            "role": self.role,
            "role_id": self.role_id,
            "permissions": self.get_permissions(),
            "is_approved": self.is_approved,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }