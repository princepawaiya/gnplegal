import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# ---------------- DATABASE PATH ----------------

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, "..", ".."))
DEFAULT_DB_PATH = os.path.join(PROJECT_ROOT, "consumer_litigation.db")

DATABASE_URL = "sqlite:///" + os.path.join(BASE_DIR, "../../consumer_litigation.db")

# ---------------- ENGINE ----------------
print("DB PATH:", DATABASE_URL)

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)

# ---------------- SESSION ----------------

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

# ---------------- BASE ----------------

Base = declarative_base()

# ---------------- DEPENDENCY ----------------

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()