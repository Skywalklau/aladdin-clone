"""
Auth Router.

Endpoints:
- POST /auth/register - Create a new user
- POST /auth/login    - Login and get JWT token
"""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.schemas.auth import RegisterRequest, TokenResponse, UserResponse
from app.services.auth_service import (
    get_user_by_email,
    create_user,
    verify_password,
    create_access_token
)
from app.routers.password_reset import send_welcome_email

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse)
def register(request: RegisterRequest, db: Session = Depends(get_db)):
    existing_user = get_user_by_email(request.email, db)
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = create_user(request.email, request.password, db, full_name=request.full_name)

    try:
        send_welcome_email(user.email, user.full_name or "")
    except Exception as e:
        print(f"[auth] Failed to send welcome email to {user.email}: {e}")

    return user


@router.post("/login", response_model=TokenResponse)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = get_user_by_email(form_data.username, db)
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(user.id)
    return TokenResponse(access_token=token)