from fastapi import HTTPException, APIRouter, Depends, Query, Body
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user_task import UserTask
from app.models.user import User
from app.services.auth import get_current_user
from app.services.task_engine import generate_auto_tasks
from pydantic import BaseModel

class TaskCreate(BaseModel):
    task_text: str

router = APIRouter(tags=["Tasks"])


@router.get("")
def list_tasks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        generate_auto_tasks(db, current_user.id)
        rows = (
            db.query(UserTask)
            .filter(UserTask.user_id == current_user.id)
            .order_by(UserTask.created_at.desc())
            .all()
        )

        return [
            {
                "id": r.id,
                "task_text": r.title,
                "is_done": r.status == "done",
                "priority": r.priority,
                "is_auto": r.is_auto,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ]

    except Exception as e:
        print("🔥 TASK ERROR:", e)
        raise HTTPException(status_code=500, detail=str(e))

# ================= CREATE =================
@router.post("")
def create_task(
    payload: TaskCreate = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    print("🔥 RECEIVED:", payload.task_text)  # debug

    if not payload.task_text.strip():
        raise HTTPException(status_code=400, detail="Task cannot be empty")

    task = UserTask(
        user_id=current_user.id,
        title=payload.task_text,
        description=None,
        status="pending",
        is_auto=False,
        priority="normal",
    )

    db.add(task)
    db.commit()
    db.refresh(task)

    return {
        "id": task.id,
        "task_text": task.title,
        "is_done": False,
        "priority": task.priority,
        "is_auto": False,
    }


# ================= UPDATE =================
@router.put("/{task_id}")
def update_task(
    task_id: int,
    is_done: bool = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = db.query(UserTask).filter(
        UserTask.id == task_id,
        UserTask.user_id == current_user.id
    ).first()

    if not task:
        return {"message": "not found"}

    task.status = "done" if is_done else "pending"
    db.commit()

    return {"message": "updated"}


# ================= DELETE =================
@router.delete("/{task_id}")
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = db.query(UserTask).filter(
        UserTask.id == task_id,
        UserTask.user_id == current_user.id
    ).first()

    if not task:
        return {"message": "not found"}

    db.delete(task)
    db.commit()

    return {"message": "deleted"}