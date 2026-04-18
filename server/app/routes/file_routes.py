import os
import mimetypes

from fastapi import Response, APIRouter, Depends, HTTPException, Query, Header
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.auth import get_current_user

router = APIRouter(tags=["Files"])

BASE_STORAGE = "storage"


@router.get("/secure-file")
def get_secure_file(
    path: str = Query(...),
    token: str = Query(None),
    db: Session = Depends(get_db),
):
    if not path:
        raise HTTPException(status_code=400, detail="File path required")

    if ".." in path:
        raise HTTPException(status_code=400, detail="Invalid file path")

    # ============================
    # 🔐 AUTH VALIDATION (FIXED)
    # ============================
    from app.services.auth import verify_access_token
    from app.models.user import User

    if not token:
        raise HTTPException(status_code=401, detail="Token required")

    payload = verify_access_token(token)

    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    email = payload.get("sub")
    if not email:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    current_user = db.query(User).filter(User.email == email.strip().lower()).first()

    if not current_user:
        raise HTTPException(status_code=401, detail="User not found")

    # ============================
    # FILE PATH CLEANING
    # ============================
    clean_path = path.replace("storage/", "").lstrip("/")
    full_path = os.path.join(BASE_STORAGE, clean_path)

    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="File not found")

    # ============================
    # FILE RESPONSE
    # ============================
    mime_type, _ = mimetypes.guess_type(full_path)

    return FileResponse(
        path=full_path,
        media_type=mime_type or "application/octet-stream",
        filename=os.path.basename(full_path),
        headers={"Content-Disposition": "inline"},
    )