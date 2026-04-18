from app.database import SessionLocal
from app.models.forum import ForumType, State, District, Forum

db = SessionLocal()


# =========================
# FORUM TYPES
# =========================
def seed_forum_types():
    if db.query(ForumType).count() > 0:
        print("Forum types already seeded")
        return

    db.add_all([
        ForumType(id=1, name="DCDRC"),
        ForumType(id=2, name="SCDRC"),
        ForumType(id=3, name="NCDRC"),
    ])

    db.commit()
    print("✅ Forum types seeded")


# =========================
# STATES
# =========================
def seed_states():
    if db.query(State).count() > 0:
        print("States already seeded")
        return

    states = [
        "Delhi",
        "Maharashtra",
        "Karnataka",
        "Tamil Nadu",
        "Uttar Pradesh",
        "Gujarat",
    ]

    db.add_all([State(name=s) for s in states])
    db.commit()

    print("✅ States seeded")


# =========================
# DISTRICTS (EXPANDED CLEAN)
# =========================
def seed_districts():
    if db.query(District).count() > 0:
        print("Districts already seeded")
        return

    states = db.query(State).all()
    state_map = {s.name: s.id for s in states}

    districts = {
        "Delhi": [
            "New Delhi",
            "South Delhi",
            "West Delhi",
            "East Delhi",
        ],
        "Maharashtra": [
            "Mumbai",
            "Pune",
            "Nagpur",
            "Nashik",
        ],
        "Karnataka": [
            "Bangalore Urban",
            "Mysore",
        ],
        "Tamil Nadu": [
            "Chennai",
            "Coimbatore",
        ],
        "Uttar Pradesh": [
            "Lucknow",
            "Noida",
            "Ghaziabad",
        ],
        "Gujarat": [
            "Ahmedabad",
            "Surat",
        ],
    }

    for state_name, dists in districts.items():
        for d in dists:
            db.add(District(name=d, state_id=state_map[state_name]))

    db.commit()
    print("✅ Districts seeded")


# =========================
# AUTO CREATE FORUMS (SMART)
# =========================
def seed_forums():
    if db.query(Forum).count() > 0:
        print("Forums already seeded")
        return

    states = db.query(State).all()
    districts = db.query(District).all()

    # =====================
    # DCDRC (ALL DISTRICTS)
    # =====================
    for d in districts:
        state = db.query(State).filter(State.id == d.state_id).first()

        name = f"District Consumer Disputes Redressal Commission, {d.name}, {state.name}"

        db.add(
            Forum(
                name=name,
                forum_type_id=1,
                state_id=state.id,
                district_id=d.id,
            )
        )

    # =====================
    # SCDRC (ALL STATES)
    # =====================
    for s in states:
        name = f"State Consumer Disputes Redressal Commission, {s.name}"

        db.add(
            Forum(
                name=name,
                forum_type_id=2,
                state_id=s.id,
            )
        )

    # =====================
    # NCDRC (ONE)
    # =====================
    delhi = next((s for s in states if s.name == "Delhi"), None)

    if delhi:
        db.add(
            Forum(
                name="National Consumer Disputes Redressal Commission, New Delhi",
                forum_type_id=3,
                state_id=delhi.id,
            )
        )

    db.commit()
    print("✅ Forums auto-created")


# =========================
# RUN ALL
# =========================
def run():
    seed_forum_types()
    seed_states()
    seed_districts()
    seed_forums()

    print("\n🎉 ALL DATA SEEDED SUCCESSFULLY")


if __name__ == "__main__":
    run()