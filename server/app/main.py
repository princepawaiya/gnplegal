from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.database import engine, Base

# ---------------- MODELS ----------------
from app.models import (
    User,
    Client,
    ClientSPOC,
    Matter,
    LocalCounsel,
    MatterLocalCounsel,
    ForumType,
    State,
    District,
    Forum,
    Invoice,
    HearingStage,
)

# ---------------- ROUTERS ----------------

# AUTH + USERS
from app.api.auth import router as auth_router
from app.routes.user_routes import router as user_router

# CORE
from app.routes.client_routes import router as client_router
from app.routes.matter_routes import router as matter_router
from app.routes.local_counsel_routes import router as local_counsel_router
from app.routes.forum_routes import router as forum_router
from app.routes.jurisdiction_routes import router as jurisdiction_router

# BUSINESS
from app.routes.invoice_routes import router as invoice_router
from app.routes.product_routes import router as product_router
from app.routes.import_routes import router as import_router

# DASHBOARD / ANALYTICS
from app.routes.dashboard import router as dashboard_router
from app.routes.mis_dashboard_routes import router as mis_dashboard_router
from app.routes.lawyer_performance_routes import router as performance_router

# EXTRA
from app.routes.cause_list_routes import router as cause_list_router
from app.routes.alerts_routes import router as alerts_router
from app.routes.role_routes import router as role_router
from app.routes import hearing_routes
from app.routes.file_routes import router as file_router
from app.routes.gnp_counsel_routes import router as gnp_counsel_router
from app.routes.gnp_admin_routes import router as gnp_admin_router
from app.routes.tasks_routes import router as tasks_router
from app.routes.knowledge import router as knowledge_router


import os

# ---------------- APP ----------------
app = FastAPI(title="Consumer Litigation Manager")

# ---------------- CORS ----------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://app.gnplegal.in",   # ✅ production
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------- DATABASE ----------------
# ⚠️ DEV ONLY (disable in production if using migrations)
Base.metadata.create_all(bind=engine)

# ---------------- SEED FORUM TYPES ----------------
from sqlalchemy.orm import Session
from app.database import SessionLocal

def seed_forum_types():
    db: Session = SessionLocal()

    try:
        existing = {ft.name.lower(): ft.id for ft in db.query(ForumType).all()}

        required_types = [
            # 🔥 EXISTING (DO NOT CHANGE IDS)
            "DCDRC",
            "SCDRC",
            "NCDRC",

            # 🆕 COURTS / LEGAL
            "District Court",
            "High Court",
            "Supreme Court",

            # 🆕 TRIBUNALS
            "DRT",
            "DRAT",

            # 🆕 SPECIAL CASE TYPES
            "138 Complaint",
            "Sarfaesi Complaint",
            "Arbitration",

            # 🆕 NON-COURT
            "Police Complaint",
            "Legal Metrology",
            "Legal Notice",
        ]

        for name in required_types:
            if name.lower() not in existing:
                db.add(ForumType(name=name))

        db.commit()

    except Exception as e:
        print("❌ ForumType seeding failed:", e)
        db.rollback()
    finally:
        db.close()


# 🔥 RUN SEED
seed_forum_types()

# ---------------- STORAGE ----------------
if not os.path.exists("storage"):
    os.makedirs("storage")

app.mount("/storage", StaticFiles(directory="storage"), name="storage")

# ---------------- ROUTES ----------------

# AUTH
app.include_router(auth_router, prefix="/auth")
app.include_router(user_router, prefix="/auth/users")

# CORE
app.include_router(client_router, prefix="/clients")
app.include_router(matter_router, prefix="/matters")
app.include_router(local_counsel_router, prefix="/local-counsels")
app.include_router(forum_router, prefix="/forums")
app.include_router(jurisdiction_router, prefix="/forums")

# BUSINESS
app.include_router(invoice_router, prefix="/invoices")
app.include_router(product_router, prefix="/products")
app.include_router(import_router, prefix="/import")

# DASHBOARD / ANALYTICS
app.include_router(dashboard_router, prefix="/dashboard")
app.include_router(mis_dashboard_router, prefix="/mis-dashboard")
app.include_router(performance_router, prefix="/performance")


# EXTRA
app.include_router(cause_list_router, prefix="/cause-list")
app.include_router(alerts_router, prefix="/alerts")
app.include_router(role_router, prefix="/roles")
app.include_router(hearing_routes.router, prefix="/hearings")
app.include_router(gnp_counsel_router, prefix="/gnp-counsel")
app.include_router(file_router)
app.include_router(gnp_admin_router, prefix="/gnp-admin")
app.include_router(tasks_router, prefix="/tasks")
app.include_router(knowledge_router, prefix="/knowledge")

# ---------------- FRONTEND ----------------

# Serve built frontend
if os.path.exists("dist/assets"):
    app.mount("/assets", StaticFiles(directory="dist/assets"), name="assets")

@app.get("/")
def root():
    return {"status": "API running"}

@app.get("/app/{full_path:path}")
def serve_frontend(full_path: str):
    return FileResponse("dist/index.html")

@app.get("/test-api")
def test():
    return {"status": "API working"}