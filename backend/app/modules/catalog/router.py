"""Catalog: categories, products, search, likes"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.models import (
    Category, Product, ProductMedia, ProductOption, ProductOptionValue,
    ProductVariant, Favorite, ProductStatus, User
)
from app.core.storage import get_file_url
from app.core.security import decode_access_token

router = APIRouter(prefix="/api/v1", tags=["catalog"])

_bearer = HTTPBearer(auto_error=False)


def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """Like get_current_user but returns None instead of 401 when unauthenticated."""
    if not credentials:
        return None
    payload = decode_access_token(credentials.credentials)
    if not payload or payload.get("type") != "customer":
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    return db.query(User).filter(User.id == int(user_id), User.is_blocked == False).first()


# ─── Schemas ─────────────────────────────────────────────────────────────────

class CategoryOut(BaseModel):
    id: int
    name_i18n: dict
    slug: str
    icon: Optional[str]
    sort_order: int

    class Config:
        from_attributes = True


class ProductListItem(BaseModel):
    id: int
    title_i18n: dict
    base_price: float
    currency: str
    likes_count: int
    is_liked: bool = False
    thumbnail_url: Optional[str] = None

    class Config:
        from_attributes = True


class OptionValueOut(BaseModel):
    id: int
    value_i18n: dict
    image_url: Optional[str]


class OptionOut(BaseModel):
    id: int
    name_i18n: dict
    values: list[OptionValueOut]


class VariantOut(BaseModel):
    id: int
    sku: Optional[str]
    option_value_ids: list
    price: float
    image_url: Optional[str]
    is_active: bool


class MediaOut(BaseModel):
    url: str
    kind: str
    source_platform: Optional[str]


class ProductDetailOut(BaseModel):
    id: int
    title_i18n: dict
    description_i18n: Optional[dict]
    base_price: float
    shipping_fee: float
    currency: str
    likes_count: int
    is_liked: bool = False
    media: list[MediaOut]
    options: list[OptionOut]
    variants: list[VariantOut]


# ─── Helpers ─────────────────────────────────────────────────────────────────

def get_thumbnail(product: Product) -> Optional[str]:
    gallery = [m for m in product.media if m.kind == "gallery"]
    if gallery:
        return get_file_url(gallery[0].url) if not gallery[0].url.startswith("http") else gallery[0].url
    return None


def is_liked(db: Session, user_id: int, product_id: int) -> bool:
    return db.query(Favorite).filter_by(user_id=user_id, product_id=product_id).first() is not None


# ─── Routes ──────────────────────────────────────────────────────────────────

@router.get("/categories", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db)):
    cats = db.query(Category).filter(Category.is_active == True, Category.parent_id == None)\
               .order_by(Category.sort_order).all()
    return cats


@router.get("/products/liked", response_model=list[ProductListItem])
def liked_products(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    favs = db.query(Favorite).filter_by(user_id=user.id).all()
    result = []
    for fav in favs:
        p = fav.product
        if p:
            result.append(ProductListItem(
                id=p.id,
                title_i18n=p.title_i18n,
                base_price=float(p.base_price),
                currency=p.currency,
                likes_count=p.likes_count,
                is_liked=True,
                thumbnail_url=get_thumbnail(p),
            ))
    return result


@router.get("/products", response_model=list[ProductListItem])
def list_products(
    category_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    q = db.query(Product).filter(Product.status == ProductStatus.active)
    if category_id:
        q = q.filter(Product.category_id == category_id)
    if search:
        q = q.filter(Product.title_i18n.cast(str).ilike(f"%{search}%"))
    products = q.order_by(Product.sort_order.desc(), Product.created_at.desc())\
                 .offset((page - 1) * limit).limit(limit).all()
    liked_ids: set[int] = set()
    if current_user:
        liked_ids = {f.product_id for f in db.query(Favorite).filter_by(user_id=current_user.id).all()}
    return [
        ProductListItem(
            id=p.id,
            title_i18n=p.title_i18n,
            base_price=float(p.base_price),
            currency=p.currency,
            likes_count=p.likes_count,
            is_liked=p.id in liked_ids,
            thumbnail_url=get_thumbnail(p),
        )
        for p in products
    ]


@router.get("/products/{product_id}", response_model=ProductDetailOut)
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
):
    product = db.query(Product).filter(
        Product.id == product_id,
        Product.status == ProductStatus.active
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    media_out = []
    for m in sorted(product.media, key=lambda x: x.sort_order):
        url = get_file_url(m.url) if not m.url.startswith("http") else m.url
        media_out.append(MediaOut(url=url, kind=m.kind, source_platform=m.source_platform))

    options_out = []
    for opt in sorted(product.options, key=lambda x: x.sort_order):
        vals = [
            OptionValueOut(
                id=v.id,
                value_i18n=v.value_i18n,
                image_url=get_file_url(v.image_url) if v.image_url and not v.image_url.startswith("http") else v.image_url,
            )
            for v in sorted(opt.values, key=lambda x: x.sort_order)
        ]
        options_out.append(OptionOut(id=opt.id, name_i18n=opt.name_i18n, values=vals))

    variants_out = [
        VariantOut(
            id=v.id, sku=v.sku,
            option_value_ids=v.option_value_ids,
            price=float(v.price),
            image_url=get_file_url(v.image_url) if v.image_url and not v.image_url.startswith("http") else v.image_url,
            is_active=v.is_active,
        )
        for v in product.variants if v.is_active
    ]

    return ProductDetailOut(
        id=product.id,
        title_i18n=product.title_i18n,
        description_i18n=product.description_i18n,
        base_price=float(product.base_price),
        shipping_fee=float(product.shipping_fee or 0),
        currency=product.currency,
        likes_count=product.likes_count,
        media=media_out,
        options=options_out,
        variants=variants_out,
    )


@router.post("/products/{product_id}/like", status_code=204)
def toggle_like(
    product_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    fav = db.query(Favorite).filter_by(user_id=user.id, product_id=product_id).first()
    if fav:
        db.delete(fav)
        product.likes_count = max(0, product.likes_count - 1)
    else:
        db.add(Favorite(user_id=user.id, product_id=product_id))
        product.likes_count += 1
    db.commit()



