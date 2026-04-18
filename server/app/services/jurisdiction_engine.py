from sqlalchemy.orm import Session

from app.models.forum import Forum
from app.services.jurisdiction import compute_forum_type_by_claim_amount


def suggest_forum(db: Session, payload: dict):
    claim_amount = payload.get("claim_amount")
    state_id = payload.get("state_id")
    district_id = payload.get("district_id")

    forum_type_id = compute_forum_type_by_claim_amount(claim_amount)

    query = db.query(Forum).filter(Forum.forum_type_id == forum_type_id)

    if forum_type_id == 1 and district_id:
        query = query.filter(Forum.district_id == district_id)

    if forum_type_id in [2, 3] and state_id:
        query = query.filter(Forum.state_id == state_id)

    forum = query.first()

    return {
        "forum_type_id": forum_type_id,
        "forum_id": forum.id if forum else None,
        "forum_name": forum.name if forum else None,
    }