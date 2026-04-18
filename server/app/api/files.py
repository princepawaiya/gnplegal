from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import FileResponse
import os

router = APIRouter()

BASE_STORAGE = "storage"


@router.get("/secure-file")
def get_file(path: str = Query(...)):
    safe_path = os.path.normpath(path)

    if ".." in safe_path:
        raise HTTPException(status_code=400, detail="Invalid path")

    full_path = os.path.join(BASE_STORAGE, safe_path)

    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(full_path)