from datetime import datetime
from sqlalchemy.orm import Session

from app.models.user_task import UserTask
from app.models.matter import Matter
from app.models.invoice import Invoice
from app.models.invoice_payment import InvoicePayment


def generate_auto_tasks(db: Session, user_id: int):
    """
    Smart legal task generator.
    Runs on dashboard load / cron.
    """

    today = datetime.utcnow().date()

    # ================= CLEAN ONLY ACTIVE AUTO TASKS =================
    db.query(UserTask).filter(
        UserTask.user_id == user_id,
        UserTask.is_auto == True,
        UserTask.status == "pending"   # ✅ DO NOT DELETE DONE TASKS
    ).delete()

    db.commit()

    # ================= HEARING TASKS =================
    matters = db.query(Matter).filter(
        Matter.gnp_lawyer_id == user_id,
        Matter.is_deleted == False,
        Matter.is_active == True,
    ).all()

    for m in matters:
        if not m.ndoh:
            continue

        hearing_date = m.ndoh   # ✅ FIXED (already Date)
        diff = (hearing_date - today).days

        if diff < 0:
            create_task_if_not_exists(
                db,
                user_id,
                f"Missed hearing: {m.matter_name}",
                "hearing",
                m.id,
                "critical"
            )

        elif diff == 0:
            create_task_if_not_exists(
                db,
                user_id,
                f"Hearing today: {m.matter_name}",
                "hearing",
                m.id,
                "high"
            )

        elif diff <= 3:
            create_task_if_not_exists(
                db,
                user_id,
                f"Prepare for hearing ({diff} days): {m.matter_name}",
                "hearing",
                m.id,
                "normal"
            )

    # ================= STAGE BASED TASKS =================
    for m in matters:
        stage = (m.current_stage or "").lower()

        if "reply" in stage:
            create_task_if_not_exists(
                db,
                user_id,
                f"Draft reply: {m.matter_name}",
                "matter",
                m.id,
                "high"
            )

        if "filing" in stage:
            create_task_if_not_exists(
                db,
                user_id,
                f"File documents: {m.matter_name}",
                "matter",
                m.id,
                "high"
            )

        if not m.ndoh:
            create_task_if_not_exists(
                db,
                user_id,
                f"Update next date: {m.matter_name}",
                "matter",
                m.id,
                "critical"
            )

    # ================= INVOICE TASKS (FIXED USER FILTER) =================
    invoices = db.query(Invoice).all()

    try:
        for inv in invoices:
            total = float(inv.final_total or 0)

            payments = db.query(InvoicePayment).filter(
                InvoicePayment.invoice_id == inv.id
            ).all()

            paid = sum(float(p.amount or 0) for p in payments)

            balance = total - paid

            if balance <= 0:
                continue

            priority = "high" if inv.status == "partial" else "normal"

            create_task_if_not_exists(
                db,
                user_id,
                f"Collect payment: Invoice {inv.invoice_no}",
                "invoice",
                inv.id,
                priority
            )
    except Exception as e:
        print("🔥 INVOICE TASK ERROR:", e)
   
    db.commit()


# ================= SAFE CREATE =================
def create_task_if_not_exists(db, user_id, text, source_type, source_id, priority):
    exists = db.query(UserTask).filter(
        UserTask.user_id == user_id,
        UserTask.source_type == source_type,
        UserTask.source_id == source_id,
        UserTask.title == text,
        UserTask.status == "pending"   # ✅ prevent duplicates
    ).first()

    if exists:
        return

    task = UserTask(
        user_id=user_id,
        title=text,
        status="pending",
        is_auto=True,
        source_type=source_type,
        source_id=source_id,
        priority=priority,
    )

    db.add(task)