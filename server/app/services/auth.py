from datetime import datetime, timedelta
import json
import os

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.user import User


# ================= CONFIG =================

SECRET_KEY = os.getenv("SECRET_KEY", "dev_fallback_key_change_later")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 60))

security = HTTPBearer(auto_error=False)


# ================= DB =================

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ================= TOKEN =================

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def verify_access_token(token: str):
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None


# ================= PERMISSIONS =================

def build_permission_map(user: User):
    perms = {}

    if (user.role or "").strip().lower() == "admin":
        perms["*"] = True
        return perms

    if user.role_obj:
        try:
            for p in user.role_obj.get_permissions():
                if isinstance(p, str) and p.strip():
                    perms[p.strip()] = True
        except Exception:
            pass

    if user.permissions:
        try:
            user_perms = json.loads(user.permissions)
            if isinstance(user_perms, list):
                for p in user_perms:
                    if isinstance(p, str) and p.strip():
                        perms[p.strip()] = True
        except Exception:
            pass

    return perms


# ================= CURRENT USER =================

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    token = credentials.credentials
    payload = verify_access_token(token)

    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    email = payload.get("sub")
    if not email or not isinstance(email, str):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    user = db.query(User).filter(User.email == email.strip().lower()).first()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    if getattr(user, "is_deleted", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account deleted",
        )

    if hasattr(user, "is_active") and user.is_active is False:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account inactive",
        )

    if not user.is_approved:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User not approved yet",
        )

    user.permission_map = build_permission_map(user)
    return user


# ================= PERMISSION CHECK =================

def require_permission(permission: str):
    def dependency(current_user: User = Depends(get_current_user)):
        perms = getattr(current_user, "permission_map", {}) or {}

        if perms.get("*"):
            return current_user

        if perms.get(permission):
            return current_user

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission '{permission}' required",
        )

    return dependency