import secrets
import smtplib
from datetime import datetime, timedelta, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.database import get_db
from app.models.portfolio import User
from app.models.password_reset_token import PasswordResetToken
from app.services.auth_service import hash_password

router = APIRouter(prefix="/auth", tags=["auth"])

TOKEN_EXPIRE_MINUTES = 30


# ── Schemas ───────────────────────────────────────────────────────────────────

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


# ── Shared SMTP helper ────────────────────────────────────────────────────────

def _send_email(to_email: str, subject: str, html: str) -> None:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = settings.SMTP_FROM
    msg["To"]      = to_email
    msg.attach(MIMEText(html, "html"))

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
        server.ehlo()
        if settings.SMTP_TLS:
            server.starttls()
        if settings.SMTP_USER and settings.SMTP_PASSWORD:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.sendmail(settings.SMTP_FROM, to_email, msg.as_string())


# ── Welcome email ─────────────────────────────────────────────────────────────

def send_welcome_email(to_email: str, full_name: str) -> None:
    login_url = f"{settings.FRONTEND_URL}/login"
    first_name = full_name.split()[0] if full_name else "there"

    html = f"""
    <div style="font-family:'IBM Plex Mono',monospace;background:#020810;color:#EDE8DF;padding:40px;max-width:520px;margin:0 auto;border:1px solid rgba(184,148,60,0.15);border-radius:12px;">

        <h1 style="font-family:'Cormorant Garamond',serif;font-size:28px;margin:0 0 4px;color:#EDE8DF;">
            Ala<span style="color:#C9A84C;">ddin</span>
        </h1>
        <p style="font-size:11px;color:#8BA4BE;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 32px;">
            Portfolio Risk Platform
        </p>

        <p style="font-size:15px;color:#EDE8DF;margin:0 0 8px;font-family:'Cormorant Garamond',serif;">
            Welcome, {first_name}.
        </p>
        <p style="font-size:12px;color:#8BA4BE;margin:0 0 28px;line-height:1.6;">
            Your account has been created. You now have access to institutional-grade
            portfolio risk management tools.
        </p>

        <!-- Features -->
        <div style="border:1px solid rgba(184,148,60,0.12);border-radius:8px;overflow:hidden;margin:0 0 28px;">

            <div style="padding:14px 16px;border-bottom:1px solid rgba(184,148,60,0.08);display:flex;align-items:center;gap:12px;">
                <span style="color:#C9A84C;font-size:12px;">▲</span>
                <div>
                    <p style="font-size:11px;color:#EDE8DF;margin:0 0 2px;">Risk Analytics</p>
                    <p style="font-size:10px;color:#8BA4BE;margin:0;">VaR · Volatility · Beta · Sharpe · Correlations</p>
                </div>
            </div>

            <div style="padding:14px 16px;border-bottom:1px solid rgba(184,148,60,0.08);display:flex;align-items:center;gap:12px;">
                <span style="color:#C9A84C;font-size:12px;">◈</span>
                <div>
                    <p style="font-size:11px;color:#EDE8DF;margin:0 0 2px;">Stress Testing</p>
                    <p style="font-size:10px;color:#8BA4BE;margin:0;">Market crash · Sector shock · Rate shock · Historical crises</p>
                </div>
            </div>

            <div style="padding:14px 16px;border-bottom:1px solid rgba(184,148,60,0.08);display:flex;align-items:center;gap:12px;">
                <span style="color:#C9A84C;font-size:12px;">◎</span>
                <div>
                    <p style="font-size:11px;color:#EDE8DF;margin:0 0 2px;">AI Insights</p>
                    <p style="font-size:10px;color:#8BA4BE;margin:0;">News sentiment · Per-stock & portfolio-level analysis</p>
                </div>
            </div>

            <div style="padding:14px 16px;display:flex;align-items:center;gap:12px;">
                <span style="color:#C9A84C;font-size:12px;">▣</span>
                <div>
                    <p style="font-size:11px;color:#EDE8DF;margin:0 0 2px;">Portfolio Management</p>
                    <p style="font-size:10px;color:#8BA4BE;margin:0;">CSV import · Live P&L · Multi-portfolio support</p>
                </div>
            </div>

        </div>

        <a href="{login_url}"
           style="display:inline-block;background:linear-gradient(135deg,#C9A84C 0%,#A8892E 100%);color:#020810;padding:12px 28px;border-radius:6px;text-decoration:none;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;font-weight:500;">
            Get Started →
        </a>

        <p style="font-size:10px;color:#4A6070;margin:28px 0 0;line-height:1.6;">
            You're receiving this because you created an account at Aladdin.<br/>
            If this wasn't you, please ignore this email.
        </p>
    </div>
    """

    _send_email(to_email, "Welcome to Aladdin", html)


# ── Password reset email ──────────────────────────────────────────────────────

def send_reset_email(to_email: str, token: str) -> None:
    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"

    html = f"""
    <div style="font-family:'IBM Plex Mono',monospace;background:#020810;color:#EDE8DF;padding:40px;max-width:480px;margin:0 auto;border:1px solid rgba(184,148,60,0.15);border-radius:12px;">
        <h1 style="font-family:'Cormorant Garamond',serif;font-size:28px;margin:0 0 8px;color:#EDE8DF;">
            Ala<span style="color:#C9A84C;">ddin</span>
        </h1>
        <p style="font-size:11px;color:#8BA4BE;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 32px;">
            Portfolio Risk Platform
        </p>
        <p style="font-size:13px;color:#EDE8DF;margin:0 0 12px;">
            We received a request to reset your password.
        </p>
        <p style="font-size:12px;color:#8BA4BE;margin:0 0 24px;">
            This link expires in {TOKEN_EXPIRE_MINUTES} minutes.
        </p>
        <a href="{reset_url}"
           style="display:inline-block;background:linear-gradient(135deg,#C9A84C 0%,#A8892E 100%);color:#020810;padding:12px 28px;border-radius:6px;text-decoration:none;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;font-weight:500;">
            Reset Password →
        </a>
        <p style="font-size:10px;color:#4A6070;margin:28px 0 0;">
            If you didn't request this, you can safely ignore this email.
        </p>
    </div>
    """

    _send_email(to_email, "Reset your Aladdin password", html)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/forgot-password")
def forgot_password(body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()

    if not user:
        return {"message": "If that email is registered, a reset link has been sent."}

    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id
    ).delete()

    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=TOKEN_EXPIRE_MINUTES)

    db.add(PasswordResetToken(user_id=user.id, token=token, expires_at=expires_at))
    db.commit()

    try:
        send_reset_email(user.email, token)
    except Exception as e:
        print(f"[password_reset] Failed to send email to {user.email}: {e}")

    return {"message": "If that email is registered, a reset link has been sent."}


@router.post("/reset-password")
def reset_password(body: ResetPasswordRequest, db: Session = Depends(get_db)):
    record = db.query(PasswordResetToken).filter(
        PasswordResetToken.token == body.token
    ).first()

    if not record:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link.")

    if record.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        db.delete(record)
        db.commit()
        raise HTTPException(status_code=400, detail="This reset link has expired. Please request a new one.")

    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")

    user = db.query(User).filter(User.id == record.user_id).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid reset link.")

    user.hashed_password = hash_password(body.new_password)
    db.delete(record)
    db.commit()

    return {"message": "Password updated successfully."}