"""Users module: profile, addresses"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.models import User, Address

router = APIRouter(prefix="/api/v1/users", tags=["users"])


class UserProfileOut(BaseModel):
    id: int
    telegram_id: int
    username: Optional[str]
    first_name: Optional[str]
    last_name: Optional[str]
    language: str
    phone: Optional[str]


class UserUpdateIn(BaseModel):
    language: Optional[str] = None
    phone: Optional[str] = None


class AddressIn(BaseModel):
    recipient: str
    phone: str
    country: str = "Uzbekistan"
    region: Optional[str] = None
    city: str
    street: str
    postal_code: Optional[str] = None
    is_default: bool = False


class AddressOut(BaseModel):
    id: int
    recipient: str
    phone: str
    country: str
    region: Optional[str]
    city: str
    street: str
    postal_code: Optional[str]
    is_default: bool


@router.get("/me", response_model=UserProfileOut)
def get_profile(user: User = Depends(get_current_user)):
    return UserProfileOut(
        id=user.id,
        telegram_id=user.telegram_id,
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        language=user.language,
        phone=user.phone,
    )


@router.patch("/me", response_model=UserProfileOut)
def update_profile(
    body: UserUpdateIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if body.language is not None:
        user.language = body.language
    if body.phone is not None:
        user.phone = body.phone
    db.commit()
    db.refresh(user)
    return get_profile(user)


@router.get("/me/addresses", response_model=list[AddressOut])
def list_addresses(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(Address).filter(Address.user_id == user.id).all()


@router.post("/me/addresses", response_model=AddressOut, status_code=201)
def create_address(
    body: AddressIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if body.is_default:
        db.query(Address).filter(Address.user_id == user.id).update({"is_default": False})

    addr = Address(user_id=user.id, **body.model_dump())
    db.add(addr)
    db.commit()
    db.refresh(addr)
    return addr


@router.put("/me/addresses/{addr_id}", response_model=AddressOut)
def update_address(
    addr_id: int, body: AddressIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    addr = db.query(Address).filter(Address.id == addr_id, Address.user_id == user.id).first()
    if not addr:
        raise HTTPException(status_code=404, detail="Address not found")
    if body.is_default:
        db.query(Address).filter(Address.user_id == user.id, Address.id != addr_id)\
                          .update({"is_default": False})
    for k, v in body.model_dump().items():
        setattr(addr, k, v)
    db.commit()
    db.refresh(addr)
    return addr


@router.delete("/me/addresses/{addr_id}", status_code=204)
def delete_address(
    addr_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    addr = db.query(Address).filter(Address.id == addr_id, Address.user_id == user.id).first()
    if not addr:
        raise HTTPException(status_code=404, detail="Address not found")
    db.delete(addr)
    db.commit()
