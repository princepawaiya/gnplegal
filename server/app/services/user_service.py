from app.models.user import User
from app.models.client import Client
from app.models.client_spoc import ClientSPOC
from app.services.security import get_password_hash
import json

def create_user_full_profile(db, payload, is_approved=False):
    email = payload["email"].strip().lower()

    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise Exception("Email already exists")

    user = User(
        email=email,
        full_name=payload.get("full_name"),
        role=payload.get("role"),
        hashed_password=get_password_hash(payload.get("password")),
        is_approved=is_approved,
        designation=payload.get("designation"),
        reference=payload.get("reference"),
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    # ================= CLIENT =================
    if payload.get("role") == "client":
        client = Client(
            legal_name=payload.get("legal_name"),
            client_type=payload.get("client_type"),
            registered_address=payload.get("registered_address"),
            corporate_address=payload.get("corporate_address"),
            billing_address=payload.get("billing_address"),
            pan=payload.get("pan"),
            created_by=user.id,
        )
        db.add(client)
        db.commit()
        db.refresh(client)

        # SPOCs
        spocs = payload.get("spocs")
        if spocs:
            for s in spocs:
                db.add(ClientSPOC(
                    client_id=client.id,
                    name=s.get("name"),
                    email=s.get("email"),
                    mobile=s.get("mobile"),
                ))
        db.commit()

    return user