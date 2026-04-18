from datetime import datetime

def compute_matter_risk(matter):
    today = datetime.utcnow().date()

    risk = {
        "overdue": False,
        "stale": False,
        "high_value": False,
        "priority": "LOW"
    }

    if matter.ndoh and matter.ndoh < today and not matter.is_disposed:
        risk["overdue"] = True

    if matter.ldoh:
        diff = (today - matter.ldoh).days
        if diff > 30:
            risk["stale"] = True

    if (matter.claim_amount or 0) > 500000:
        risk["high_value"] = True

    if risk["overdue"]:
        risk["priority"] = "HIGH"
    elif risk["stale"] or risk["high_value"]:
        risk["priority"] = "MEDIUM"

    return risk