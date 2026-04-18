from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.product import Product
from app.models.user import User
from app.services.auth import get_current_user


router = APIRouter(tags=["Products"])


def require_permission(user: User, permission: str):
    perms = getattr(user, "permission_map", {}) or {}
    if perms.get("*") or perms.get(permission):
        return
    raise HTTPException(status_code=403, detail="Permission denied")


@router.get("/list")
def list_products(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = db.query(Product).order_by(Product.name.asc()).all()
    return [{"id": p.id, "name": p.name} for p in rows]


@router.post("/create")
def create_product(
    payload: dict = None,
    name: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "matters:create")

    # ✅ support BOTH frontend + manual calls
    if payload and isinstance(payload, dict):
        name = payload.get("name")

    name = (name or "").strip()

    if not name:
        raise HTTPException(status_code=400, detail="Product name is required")

    existing = db.query(Product).filter(Product.name == name).first()
    if existing:
        return {"id": existing.id, "name": existing.name}

    row = Product(name=name)
    db.add(row)
    db.commit()
    db.refresh(row)

    return {"id": row.id, "name": row.name}


@router.delete("/{product_id}/delete")
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "matters:edit")

    row = db.query(Product).filter(Product.id == product_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Product not found")

    db.delete(row)
    db.commit()

    return {"message": "Product deleted successfully"}