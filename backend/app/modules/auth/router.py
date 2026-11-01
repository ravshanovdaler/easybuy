"""Auth module: Telegram initData → JWT"""
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import validate_telegram_init_data
from app.core.models import User
from app.core.security import create_access_token

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


class TelegramAuthRequest(BaseModel):
    init_data: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    language: str


@router.post("/telegram", response_model=TokenResponse)
def auth_telegram(body: TelegramAuthRequest, db: Session = Depends(get_db)):
    tg_user = validate_telegram_init_data(body.init_data)
    if not tg_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Telegram initData")

    telegram_id = tg_user.get("id")
    if not telegram_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No user id in initData")

    # Upsert user
    user = db.query(User).filter(User.telegram_id == telegram_id).first()
    if user:
        user.username   = tg_user.get("username", user.username)
        user.first_name = tg_user.get("first_name", user.first_name)
        user.last_name  = tg_user.get("last_name", user.last_name)
        user.last_seen_at = datetime.now(timezone.utc)
    else:
        lang = tg_user.get("language_code", "ru")[:2]
        user = User(
            telegram_id=telegram_id,
            username=tg_user.get("username"),
            first_name=tg_user.get("first_name"),
            last_name=tg_user.get("last_name"),
            language=lang if lang in ("ru", "uz") else "ru",
        )
        db.add(user)

    if user.is_blocked:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account blocked")

    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": str(user.id), "type": "customer"})
    return TokenResponse(access_token=token, user_id=user.id, language=user.language)
