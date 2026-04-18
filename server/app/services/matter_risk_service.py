from datetime import date


# ================= CORE FUNCTION USED IN ROUTES =================

def compute_matter_risk(matter):
    """
    This is the ONLY function used by frontend (via matter_routes)

    Returns:
    {
        priority: High / Medium / Low,
        overdue: bool,
        stale: bool,
        high_value: bool
    }
    """

    today = date.today()

    # ================= HIGH VALUE =================
    claim = matter.claim_amount or 0
    high_value = claim >= 500000  # 5L+

    # ================= OVERDUE =================
    overdue = False
    if matter.ndoh and matter.ndoh < today:
        overdue = True

    # ================= STALE =================
    stale = False
    if matter.ldoh:
        days_since_last = (today - matter.ldoh).days
        if days_since_last > 90:
            stale = True

    # ================= PRIORITY =================
    score = 0

    if high_value:
        score += 2

    if overdue:
        score += 2

    if stale:
        score += 1

    if not matter.gnp_lawyer_id:
        score += 1

    if (matter.current_status or "").lower() == "pending":
        score += 1

    # ================= MAP TO PRIORITY =================
    if score >= 4:
        priority = "High"
    elif score >= 2:
        priority = "Medium"
    else:
        priority = "Low"

    return {
        "priority": priority,
        "overdue": overdue,
        "stale": stale,
        "high_value": high_value,
    }


# ================= OPTIONAL (FOR DASHBOARD / MIS) =================

def calculate_portfolio_risk(matters):
    """
    Aggregated stats for dashboards
    """

    results = [compute_matter_risk(m) for m in matters]

    total = len(results)

    if total == 0:
        return {
            "high": 0,
            "medium": 0,
            "low": 0,
        }

    high = sum(1 for r in results if r["priority"] == "High")
    medium = sum(1 for r in results if r["priority"] == "Medium")
    low = sum(1 for r in results if r["priority"] == "Low")

    return {
        "high": high,
        "medium": medium,
        "low": low,
    }


# ================= LEGACY SUPPORT (SAFE TO KEEP) =================

def calculate_matter_risk(matter):
    """
    Old format (not used by frontend anymore)
    Keeping for safety
    """
    result = compute_matter_risk(matter)

    return {
        "risk_score": 0,  # deprecated
        "risk_level": result["priority"],
        "factors": [],
    }


def is_high_risk(matter):
    result = compute_matter_risk(matter)
    return result["priority"] == "High"