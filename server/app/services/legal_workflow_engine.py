from datetime import datetime, timedelta


# ================= STAGE NORMALIZER =================
def derive_stage(m):
    stage = (m.current_stage or "").lower()

    if m.is_disposed:
        if not m.order_file:
            return "Order Pending"
        return "Disposed"

    if "notice" in stage:
        return "Notice Stage"

    if "reply" in stage:
        if m.reply_filed_date:
            return "Reply Filed"
        return "Reply Pending"

    if "evidence" in stage:
        return "Evidence Stage"

    if "argument" in stage:
        return "Arguments Stage"

    if "admission" in stage:
        return "Admission Stage"

    if not stage:
        return "New Matter"

    return m.current_stage


# ================= NEXT ACTION =================
def derive_next_action(m):
    stage = derive_stage(m)

    if stage == "New Matter":
        return "Review Case File"

    if stage == "Notice Stage":
        return "Ensure Notice Served"

    if stage == "Reply Pending":
        return "Draft & File Reply"

    if stage == "Reply Filed":
        return "Prepare Evidence"

    if stage == "Evidence Stage":
        return "File Evidence Affidavit"

    if stage == "Arguments Stage":
        return "Prepare Written Arguments"

    if stage == "Order Pending":
        return "Upload Order Copy"

    if stage == "Disposed":
        return "Initiate Execution / Close Case"

    return "Review Case"


# ================= PRIORITY =================
def derive_priority(m):
    today = datetime.utcnow().date()

    if not m.ndoh:
        return "MEDIUM"

    days = (m.ndoh - today).days

    if days <= 2:
        return "HIGH"
    elif days <= 7:
        return "MEDIUM"
    else:
        return "LOW"


# ================= FLAGS =================
def derive_flags(m):
    today = datetime.utcnow().date()
    flags = []

    # ❗ No next date
    if not m.ndoh:
        flags.append("NO_NEXT_DATE")

    # ❗ Overdue hearing
    if m.ndoh and m.ndoh < today and not m.is_disposed:
        flags.append("OVERDUE")

    # ❗ Hearing soon
    if m.ndoh and 0 <= (m.ndoh - today).days <= 3:
        flags.append("HEARING_SOON")

    # ❗ No stage
    if not m.current_stage:
        flags.append("STAGE_MISSING")

    # ❗ Stagnant case (no update)
    if m.updated_at:
        days_since_update = (today - m.updated_at.date()).days
        if days_since_update > 7:
            flags.append("STALE_7_DAYS")
        if days_since_update > 30:
            flags.append("STALE_30_DAYS")

    return flags


# ================= BUILD SNAPSHOT =================
def build_case_snapshot(m):
    stage = derive_stage(m)
    action = derive_next_action(m)
    priority = derive_priority(m)
    flags = derive_flags(m)

    return {
        "id": m.id,
        "case_no": m.case_no,
        "client": m.client.legal_name if m.client else "-",
        "forum": m.forum.name if m.forum else "-",
        "stage": stage,
        "next_action": action,
        "priority": priority,
        "next_date": m.ndoh,
        "flags": flags,
    }