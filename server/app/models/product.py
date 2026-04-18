from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from app.database import Base


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(String, nullable=False, unique=True, index=True)

    # ================= RELATIONSHIPS =================

    matters = relationship(
        "Matter",
        back_populates="product",
        lazy="select",
    )

    # ================= HELPERS =================

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
        }