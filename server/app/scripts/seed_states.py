from app.database import SessionLocal
from app.models.state import State

db = SessionLocal()

states = [
    "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh",
    "Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka",
    "Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram",
    "Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu",
    "Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal",
    "Andaman and Nicobar Islands","Chandigarh",
    "Dadra and Nagar Haveli and Daman and Diu","Delhi",
    "Jammu and Kashmir","Ladakh","Lakshadweep","Puducherry"
]

for name in states:
    exists = db.query(State).filter(State.name == name).first()
    if not exists:
        db.add(State(name=name))

db.commit()
print("✅ States seeded successfully")