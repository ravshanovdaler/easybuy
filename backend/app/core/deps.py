import hashlib
import hmac
import time
from urllib.parse import unquote

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import decode_access_token
from app.core.models import User, Admin

bearer_scheme = HTTPBearer(auto_error=False)


def validate_telegram_init_data(init_data: str) -> dict | None:
    """
    Validate Telegram WebApp initData per official spec.
    Returns parsed user dict or None if invalid.
    """
    try:
        params = {}
        for part in init_data.split("&"):
            if "=" in part:
                k, v = part.split("=", 1)
                params[k] = unquote(v)

        received_hash = params.pop("hash", None)
        if not received_hash:
            return None

        data_check_string = "\n".join(
            f"{k}={v}" for k, v in sorted(params.items())
        )

        secret_key = hmac.new(
            b"WebAppData", settings.BOT_TOKEN.encode(), hashlib.sha256
        ).digest()
        computed = hmac.new(
            secret_key, data_check_string.encode(), hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(computed, received_hash):
            return None

        # Check auth_date freshness (1 hour)
        auth_date = int(params.get("auth_date", 0))
        if time.time() - auth_date > 3600:
            return None

        import json
        user_str = params.get("user", "{}")
        return json.loads(user_str)

    except Exception:
        return None


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    payload = decode_access_token(credentials.credentials)
    if not payload or payload.get("type") != "customer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user or user.is_blocked:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or blocked")

    return user


def get_current_admin(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> Admin:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    payload = decode_access_token(credentials.credentials)
    if not payload or payload.get("type") != "admin":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    admin_id = payload.get("sub")
    admin = db.query(Admin).filter(Admin.id == int(admin_id), Admin.is_active == True).first()
    if not admin:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Admin not found")

    return admin


def require_owner(admin: Admin = Depends(get_current_admin)) -> Admin:
    from app.core.models import AdminRole
    if admin.role != AdminRole.owner:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Owner only")
    return admin
