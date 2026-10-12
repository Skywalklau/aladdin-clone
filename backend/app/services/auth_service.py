"""
Authentication service.

Handles:
- Password hashing and verification
- JWT token generation and validation
"""
from dotenv import load_dotenv
import os
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.models.portfolio import User

# ============================================================================
# CONFIG
# ============================================================================

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise ValueError("SECRET_KEY environment variable not set")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ============================================================================
# PASSWORD HASHING
# ============================================================================

def hash_password(password: str) -> str:
    """Hash a plain text password."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain text password against a hashed password."""
    return pwd_context.verify(plain_password, hashed_password)

# ============================================================================
# TOKEN GENERATION
# ============================================================================

def create_access_token(user_id: int) -> str:
    """
    Generate a JWT access token for a user.

    Args:
        user_id: The user's database ID

    Returns:
        Signed JWT token string
    """
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": str(user_id),
        "exp": expire
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

# ============================================================================
# TOKEN VALIDATION
# ============================================================================

def get_user_from_token(token: str, db: Session) -> Optional[User]:
    """
    Decode a JWT token and return the corresponding user.

    Args:
        token: JWT token string
        db: Database session

    Returns:
        User if token is valid, None otherwise
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload.get("sub"))
    except (JWTError, TypeError, ValueError):
        return None

    return db.query(User).filter(User.id == user_id).first()

# ============================================================================
# USER OPERATIONS
# ============================================================================

def get_user_by_email(email: str, db: Session) -> Optional[User]:
    """Fetch a user by email."""
    return db.query(User).filter(User.email == email).first()


def create_user(email: str, password: str, db: Session, full_name: str = "") -> User:
    """
    Create a new user with a hashed password.

    Args:
        email: User's email address
        password: Plain text password (will be hashed)
        db: Database session
        full_name: User's full name

    Returns:
        Newly created User
    """

    user = User(
        email=email,
        full_name=full_name,
        hashed_password=hash_password(password)
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

