"""
Auth dependency for protecting routes.
"""

from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.portfolio import User
from app.services.auth_service import get_user_from_token
from app.core.config import settings

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_PREFIX}/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    """
    Dependency that extracts and validates the current user from the JWT token.

    Usage:
        @router.get("/something")
        def my_endpoint(current_user: User = Depends(get_current_user)):
            ...

    Raises:
        401 if token is missing, invalid, or expired
    """
    user = get_user_from_token(token, db)
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token"
        )
    return user