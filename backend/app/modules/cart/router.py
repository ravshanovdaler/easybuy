"""Cart module"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.models import CartItem, Product, ProductVariant, User
from app.core.storage import get_file_url

router = APIRouter(prefix="/api/v1/cart", tags=["cart"])


class CartItemIn(BaseModel):
    product_id: int
    variant_id: Optional[int] = None
    quantity: int = 1


class CartItemOut(BaseModel):
    id: int
    product_id: int
    variant_id: Optional[int]
    quantity: int
    title_i18n: dict
    unit_price: float
    currency: str
    thumbnail_url: Optional[str]
    options_snapshot: Optional[dict] = None


@router.get("", response_model=list[CartItemOut])
def get_cart(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    items = db.query(CartItem).filter(CartItem.user_id == user.id).all()
    result = []
    for item in items:
        p = item.product
        price = float(item.variant.price) if item.variant else float(p.base_price)
        thumb = None
        if p.media:
            g = [m for m in p.media if m.kind == "gallery"]
            if g:
                thumb = get_file_url(g[0].url) if not g[0].url.startswith("http") else g[0].url
        result.append(CartItemOut(
            id=item.id,
            product_id=p.id,
            variant_id=item.variant_id,
            quantity=item.quantity,
            title_i18n=p.title_i18n,
            unit_price=price,
            currency=p.currency,
            thumbnail_url=thumb,
        ))
    return result


@router.post("", status_code=201)
def add_to_cart(body: CartItemIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    product = db.query(Product).filter(Product.id == body.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    existing = db.query(CartItem).filter_by(
        user_id=user.id, product_id=body.product_id, variant_id=body.variant_id
    ).first()

    if existing:
        existing.quantity += body.quantity
    else:
        db.add(CartItem(
            user_id=user.id,
            product_id=body.product_id,
            variant_id=body.variant_id,
            quantity=body.quantity,
        ))
    db.commit()
    return {"detail": "Added to cart"}


@router.patch("/{item_id}")
def update_cart_item(
    item_id: int, body: CartItemIn,
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    item = db.query(CartItem).filter(CartItem.id == item_id, CartItem.user_id == user.id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Cart item not found")
    if body.quantity <= 0:
        db.delete(item)
    else:
        item.quantity = body.quantity
    db.commit()
    return {"detail": "Updated"}


@router.delete("/{item_id}", status_code=204)
def remove_cart_item(
    item_id: int,
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    item = db.query(CartItem).filter(CartItem.id == item_id, CartItem.user_id == user.id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Cart item not found")
    db.delete(item)
    db.commit()


@router.delete("", status_code=204)
def clear_cart(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    db.query(CartItem).filter(CartItem.user_id == user.id).delete()
    db.commit()
