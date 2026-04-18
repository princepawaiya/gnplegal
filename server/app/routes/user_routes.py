from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from fastapi import UploadFile, File, Form
import json
import os

from app.database import get_db
from app.models.user import User
from app.services.auth import get_current_user
from app.services.security import get_password_hash
from app.services.user_service import create_user_full_profile


router = APIRouter(tags=["Users"])


def require_permission(user: User, permission: str):
    perms = getattr(user, "permission_map", {}) or {}
    if perms.get("*") or perms.get(permission):
        return
    raise HTTPException(status_code=403, detail="Permission denied")


@router.get("")
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "users:view")

    users = db.query(User)\
        .filter(User.is_deleted == False)\
        .order_by(User.id.asc())\
        .all()

    items = []
    for u in users:
        role_permissions = u.role_obj.get_permissions() if u.role_obj else []

        user_permissions = []
        if u.permissions:
            try:
                parsed = json.loads(u.permissions) if isinstance(u.permissions, str) else u.permissions
                if isinstance(parsed, list):
                    user_permissions = parsed
            except Exception:
                user_permissions = []

        items.append(
            {
                "id": u.id,
                "full_name": u.full_name,
                "email": u.email,
                "role": u.role,
                "is_approved": u.is_approved,
                "role_id": u.role_id,
                "role_name": u.role_obj.name if u.role_obj else None,
                "role_permissions": role_permissions,
                "user_permissions": user_permissions,
                "permissions": list(set((role_permissions or []) + (user_permissions or []))),
            }
        )

    return items


@router.put("/{user_id}/permissions")
def update_user_permissions(
    user_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "users:manage")

    permissions = payload.get("permissions", [])
    if not isinstance(permissions, list):
        raise HTTPException(status_code=400, detail="permissions must be a list")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.permissions = json.dumps(permissions)
    db.commit()
    db.refresh(user)

    return {
        "message": "Permissions updated successfully",
        "user": {"id": user.id, "permissions": permissions},
    }


@router.put("/{user_id}/change-password")
def change_user_password(
    user_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "users:manage")

    new_password = (payload.get("new_password") or "").strip()
    if not new_password:
        raise HTTPException(status_code=400, detail="new_password is required")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.hashed_password = get_password_hash(new_password)
    db.commit()
    db.refresh(user)

    return {
        "message": "Password changed successfully",
        "user": {"id": user.id, "email": user.email},
    }


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "users:manage")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_deleted = True
    user.deleted_at = datetime.utcnow()
    user.deleted_by = current_user.id

    db.commit()

    return {"message": "User deleted (soft)"}


@router.get("/deleted")
def get_deleted_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "users:manage")

    users = db.query(User).filter(User.is_deleted == True).all()

    return {
        "data": [
            {
                "id": u.id,
                "full_name": u.full_name,
                "email": u.email,
                "deleted_at": u.deleted_at,
            }
            for u in users
        ]
    }


@router.put("/{user_id}/restore")
def restore_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "users:manage")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_deleted = False
    user.deleted_at = None
    user.deleted_by = None

    db.commit()

    return {"message": "User restored successfully"}

# ================= CREATE USER =================

@router.post("/create-user")
def create_user(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "users:manage")

    email = (payload.get("email") or "").strip().lower()
    password = (payload.get("password") or "").strip()
    full_name = (payload.get("full_name") or "").strip()
    role = (payload.get("role") or "client").strip()

    if not email or not password or not full_name:
        raise HTTPException(status_code=400, detail="Missing required fields")

    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="User already exists")

    user = User(
        full_name=full_name,
        email=email,
        role=role,
        hashed_password=get_password_hash(password),
        is_approved=True,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "message": "User created successfully",
        "user": user.to_dict(),
    }

# ================= APPROVE USER =================

@router.put("/{user_id}/approve")
def approve_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "users:manage")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_approved = True
    db.commit()

    return {"message": "User approved"}

@router.post("/signup")
async def signup(
    role: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),

    full_name: str = Form(None),
    designation: str = Form(None),

    legal_name: str = Form(None),
    client_type: str = Form(None),

    registered_address: str = Form(None),
    corporate_address: str = Form(None),
    billing_address: str = Form(None),

    pan: str = Form(None),

    accounts_name: str = Form(None),
    accounts_email: str = Form(None),
    accounts_mobile: str = Form(None),

    reference: str = Form(None),

    spocs: str = Form(None),  # JSON string

    bar_registration_no: str = Form(None),
    upi_details: str = Form(None),

    pan_file: UploadFile = File(None),
    bar_certificate: UploadFile = File(None),

    db: Session = Depends(get_db),
):
    email = email.strip().lower()

    # ✅ CHECK DUPLICATE
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")

    # 🔐 HASH PASSWORD
    hashed_password = get_password_hash(password)

    # 📦 CREATE USER
    user = User(
        email=email,
        full_name=full_name or legal_name,
        role=role.lower(),
        hashed_password=hashed_password,

        # 🔥 IMPORTANT
        is_approved=False,   # requires admin approval

        # optional fields
        designation=designation,
        reference=reference,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    # ================= SAVE CLIENT DETAILS =================
    if role.lower() == "client":
        from app.models.client import Client
        from app.models.client_spoc import ClientSPOC

        client = Client(
            legal_name=legal_name,
            client_type=client_type,
            registered_address=registered_address,
            corporate_address=corporate_address,
            billing_address=billing_address,
            pan=pan,
            created_by=user.id,
        )

        db.add(client)
        db.commit()
        db.refresh(client)

        # 🔥 SAVE SPOCs
        if spocs:
            try:
                spoc_list = json.loads(spocs)
                for s in spoc_list:
                    db.add(ClientSPOC(
                        client_id=client.id,
                        name=s.get("name"),
                        email=s.get("email"),
                        mobile=s.get("mobile"),
                    ))
            except:
                pass

        db.commit()

    # ================= SAVE FILES =================
    upload_dir = "storage/signup"
    os.makedirs(upload_dir, exist_ok=True)

    if pan_file:
        path = os.path.join(upload_dir, f"{user.id}_pan_{pan_file.filename}")
        with open(path, "wb") as f:
            f.write(await pan_file.read())

    if bar_certificate:
        path = os.path.join(upload_dir, f"{user.id}_bar_{bar_certificate.filename}")
        with open(path, "wb") as f:
            f.write(await bar_certificate.read())

    return {
        "message": "Signup successful. Await admin approval."
    }

@router.post("/create-full-user")
def create_full_user(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_permission(current_user, "users:manage")

    user = create_user_full_profile(
        db,
        payload,
        is_approved=True   # 🔥 ADMIN CREATED = AUTO APPROVED
    )

    return {
        "message": "User created successfully",
        "user_id": user.id
    }