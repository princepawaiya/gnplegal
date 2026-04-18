from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr

from app.database import get_db
from app.models.user import User
from app.services.auth import get_current_user, create_access_token
from app.services.security import verify_password, get_password_hash
from fastapi import Form, UploadFile, File
import os, json, uuid
from app.models.client import Client
from app.models.client_spoc import ClientSPOC
from app.services.user_service import create_user_full_profile


router = APIRouter(tags=["Auth"])


# ================= SCHEMAS =================

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# ================= LOGIN =================

@router.post("/login")
def login(
    payload: LoginRequest,
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(
        User.email == payload.email.strip().lower(),
        User.is_deleted == False
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )

    if not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )

    # 🔐 GLOBAL APPROVAL CHECK (not just lawyer)
    if not user.is_approved:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User not approved yet"
        )

    # ✅ TOKEN PAYLOAD (future-proof)
    token = create_access_token({
        "sub": user.email,
        "id": user.id,
        "full_name": user.full_name,
        "role": user.role,
        "role_id": getattr(user, "role_id", None),
        "permissions": getattr(user, "permission_map", {}) or {},  # 🔥 ADD THIS
    })

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "role": user.role,
            "role_id": getattr(user, "role_id", None),
            "full_name": user.full_name,
        }
    }


# ================= CURRENT USER =================

@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "role": current_user.role,
        "role_id": getattr(current_user, "role_id", None),
        "full_name": current_user.full_name,
    }


# ================= PERMISSIONS =================

@router.get("/permissions")
def get_permissions(current_user: User = Depends(get_current_user)):
    """
    Master permission list (UI reference)
    """
    return [
        "users:view",
        "users:manage",
        "roles:view",
        "roles:assign",
        "roles:manage",

        "matters:view",
        "matters:create",
        "matters:edit",
        "matters:delete",

        "clients:view",
        "clients:create",
        "clients:edit",

        "invoices:view",
        "invoices:create",
        "invoices:approve",

        "alerts:view",
        "alerts:create",

        "mis:view",
        "mis:export",

        "causelist:view",
        "causelist:generate",

        "counsels:view",
        "counsels:create",
        "counsels:approve",

        "accounts:view",
        "accounts:manage",
    ]

# ================= CREATE USER =================

class CreateUserRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    role: str


@router.post("/create-user")
def create_user(
    payload: CreateUserRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # 🔐 Permission check
    if not current_user.permission_map.get("*") and not current_user.permission_map.get("users:manage"):
        raise HTTPException(status_code=403, detail="Permission denied")

    # ✅ Check duplicate email
    existing = db.query(User).filter(
        User.email == payload.email.strip().lower()
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")

    # 🔐 Hash password
    hashed_password = get_password_hash(payload.password)

    # 🔍 Get role object
    from app.models.role import Role

    role_obj = db.query(Role).filter(
        Role.name.ilike(payload.role.strip())
    ).first()

    # ✅ Create user
    user = User(
        full_name=payload.full_name.strip(),
        email=payload.email.strip().lower(),
        hashed_password=hashed_password,
        role=(payload.role or "").lower(),
        role_id=role_obj.id if role_obj else None,
        is_approved=True,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "message": "User created successfully",
        "user": {
            "id": user.id,
            "email": user.email,
            "role": user.role,
        },
    }

@router.post("/signup")
async def signup(
    role: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    full_name: str = Form(...),

    # CLIENT FIELDS
    designation: str = Form(None),
    client_type: str = Form(None),
    legal_name: str = Form(None),
    registered_address: str = Form(None),
    corporate_address: str = Form(None),
    billing_address: str = Form(None),
    pan: str = Form(None),

    accounts_name: str = Form(None),
    accounts_email: str = Form(None),
    accounts_mobile: str = Form(None),
    reference: str = Form(None),

    spocs: str = Form(None),

    # COUNSEL FIELDS
    city: str = Form(None),
    state: str = Form(None),
    bar_registration_no: str = Form(None),
    upi_details: str = Form(None),

    # FILES
    pan_file: UploadFile = File(None),
    bar_certificate: UploadFile = File(None),

    db: Session = Depends(get_db),
):
    print("🔥 SIGNUP HIT")
    print("ROLE:", role)
    print("EMAIL:", email)
    # ================= DUPLICATE CHECK =================
    existing = db.query(User).filter(
        User.email == email.strip().lower()
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")

    # ================= PASSWORD =================
    hashed_password = get_password_hash(password)

    # ================= CREATE USER =================
    user = User(
        full_name=full_name.strip(),
        email=email.strip().lower(),
        hashed_password=hashed_password,
        role=(role or "").lower(),
        is_approved=False,  # 🔥 ADMIN APPROVAL REQUIRED
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    # ================= CLIENT FLOW =================
    role_clean = (role or "").lower().strip()

    if role_clean == "client":
        client = Client(
            legal_name=legal_name or "",
            client_type=client_type or "",
            registered_address=registered_address or "",
            corporate_address=corporate_address or "",
            billing_address=billing_address or "",
            pan=pan or "",
        )

        db.add(client)
        db.commit()
        db.refresh(client)

        user.client_id = client.id
        db.commit()

        # 🔥 SPOCS
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

                db.commit()
            except Exception as e:
                print("SPOC ERROR:", e)

    # ================= FILE STORAGE =================
    upload_dir = "storage/uploads"
    os.makedirs(upload_dir, exist_ok=True)

    def save_file(file: UploadFile):
        if not file:
            return None

        filename = f"{uuid.uuid4()}_{file.filename}"
        path = os.path.join(upload_dir, filename)

        with open(path, "wb") as f:
            f.write(file.file.read())

        return path

    pan_path = save_file(pan_file)
    bar_path = save_file(bar_certificate)

    # OPTIONAL store if fields exist
    try:
        if hasattr(user, "pan_file"):
            user.pan_file = pan_path

        if hasattr(user, "bar_certificate"):
            user.bar_certificate = bar_path

        db.commit()
    except Exception as e:
        print("FILE SAVE ERROR:", e)

    if hasattr(user, "bar_certificate"):
        user.bar_certificate = bar_path

    db.commit()

    return {
        "ok": True,
        "message": "Signup successful. Await admin approval."
    }