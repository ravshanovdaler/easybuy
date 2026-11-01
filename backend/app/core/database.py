from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.core.config import settings

# SQLite is synchronous - perfect for PythonAnywhere free tier (WSGI)
engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False},  # needed for SQLite
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    """FastAPI dependency - yields a DB session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
