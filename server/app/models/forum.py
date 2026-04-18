from sqlalchemy import Column, Integer, String, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base


class ForumType(Base):
    __tablename__ = "forum_types"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True, index=True)

    # ================= HELPERS =================

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
        }


class State(Base):
    __tablename__ = "states"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True, index=True)

    districts = relationship(
        "District",
        back_populates="state",
        cascade="all, delete-orphan",
        lazy="select",
    )

    # ================= HELPERS =================

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
        }


class District(Base):
    __tablename__ = "districts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)

    state_id = Column(Integer, ForeignKey("states.id"), nullable=False, index=True)

    state = relationship("State", back_populates="districts", lazy="joined")

    forums = relationship(
        "Forum",
        back_populates="district",
        cascade="all, delete-orphan",
        lazy="select",
    )

    # ================= HELPERS =================

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "state_id": self.state_id,
            "state_name": self.state.name if self.state else None,
        }


class Forum(Base):
    __tablename__ = "forums"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(String, nullable=False, index=True)

    # 🔥 IMPORTANT — do not change mapping (DCDRC=1, SCDRC=2, NCDRC=3)
    forum_type_id = Column(Integer, ForeignKey("forum_types.id"), nullable=False, index=True)

    state_id = Column(Integer, ForeignKey("states.id"), nullable=True, index=True)
    district_id = Column(Integer, ForeignKey("districts.id"), nullable=True, index=True)

    address = Column(Text, nullable=True)

    # ================= RELATIONSHIPS =================

    forum_type = relationship("ForumType", lazy="joined")

    state = relationship("State", lazy="joined")

    district = relationship("District", back_populates="forums", lazy="joined")

    # ================= HELPERS =================

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "forum_type_id": self.forum_type_id,
            "forum_type": self.forum_type.name if self.forum_type else None,
            "state_id": self.state_id,
            "state": self.state.name if self.state else None,
            "district_id": self.district_id,
            "district": self.district.name if self.district else None,
            "address": self.address,
        }