from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    valid = pwd_context.verify(plain_password, hashed_password)

    # 🔥 Auto upgrade hash if needed (future-proofing)
    if valid and pwd_context.needs_update(hashed_password):
        print("⚠️ Password hash outdated — should rehash")

    return valid