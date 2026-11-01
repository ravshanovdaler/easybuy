"""
EasyBuy - Main FastAPI application
Optimized for PythonAnywhere free tier (WSGI/sync, SQLite, local storage)
"""
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.database import engine, SessionLocal
from app.core.models import Base, Admin, AppSetting
from app.core.security import hash_password

# Import all routers
from app.modules.auth.router import router as auth_router
from app.modules.catalog.router import router as catalog_router
from app.modules.cart.router import router as cart_router
from app.modules.orders.router import router as orders_router
from app.modules.payments.router import router as payments_router
from app.modules.users.router import router as users_router
from app.modules.admin.router import router as admin_router
from app.modules.bot.router import router as bot_router


def create_tables():
    """Create all tables if they don't exist."""
    Base.metadata.create_all(bind=engine)


def seed_initial_data():
    """Seed first admin and default settings if DB is empty."""
    db = SessionLocal()
    try:
        # Create first admin
        if not db.query(Admin).first():
            admin = Admin(
                email=settings.FIRST_ADMIN_EMAIL,
                password_hash=hash_password(settings.FIRST_ADMIN_PASSWORD),
                role="owner",
                is_active=True,
            )
            db.add(admin)

        # Default settings
        default_settings = {
            "service_fee_percent": 10.0,
            "shipping_fee": 0.0,
            "payment_deadline_hours": 24,
            "display_currency": "USD",
            "brand_name": "EasyBuy",
            "support_link": "https://t.me/yoursupport",
            "admin_group_chat_id": None,
        }
        for key, value in default_settings.items():
            if not db.query(AppSetting).filter(AppSetting.key == key).first():
                db.add(AppSetting(key=key, value=value))

        db.commit()
    finally:
        db.close()


# Initialize tables and default seed data synchronously on startup (avoids ASGI lifespan deadlock under WSGI)
create_tables()
seed_initial_data()

app = FastAPI(
    title="EasyBuy API",
    description="Telegram Mini App store for Chinese products",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# CORS - allow Telegram Mini App and Netlify frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://web.telegram.org",
        "https://oauth.telegram.org",
        "http://localhost:5173",
        "http://localhost:3000",
    ],
    allow_origin_regex=r"https://.*\.netlify\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded files statically
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# Register routers
app.include_router(auth_router)
app.include_router(catalog_router)
app.include_router(cart_router)
app.include_router(orders_router)
app.include_router(payments_router)
app.include_router(users_router)
app.include_router(admin_router)
app.include_router(bot_router)


@app.get("/health")
def health():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


@app.get("/")
def root():
    return {"message": "EasyBuy API", "docs": "/api/docs"}
