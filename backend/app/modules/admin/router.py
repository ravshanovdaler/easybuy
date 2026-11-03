"""Admin API router: orders, products, payments, users, settings"""
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from pydantic import BaseModel
from sqlalchemy import cast, String
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_admin, require_owner
from app.core.models import (
    Admin, AdminRole, Order, OrderStatus, Payment, PaymentStatus,
    PaymentProof, Product, ProductStatus, Category, User, AppSetting,
    PaymentMethod, AdminAuditLog, Banner
)
from app.core.security import hash_password
from app.core.storage import save_image, get_file_url
from app.modules.orders.router import change_status

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


# ─── Admin Auth ───────────────────────────────────────────────────────────────

class AdminLoginRequest(BaseModel):
    email: str
    password: str


class AdminTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


@router.post("/login", response_model=AdminTokenResponse)
def admin_login(body: AdminLoginRequest, db: Session = Depends(get_db)):
    from app.core.security import verify_password, create_access_token
    admin = db.query(Admin).filter(Admin.email == body.email, Admin.is_active == True).first()
    if not admin or not verify_password(body.password, admin.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token({"sub": str(admin.id), "type": "admin"}, expires_delta=timedelta(days=30))
    return AdminTokenResponse(access_token=token)


# ─── Orders ──────────────────────────────────────────────────────────────────

class AdminOrderListItem(BaseModel):
    id: int
    number: str
    status: str
    total: float
    user_telegram_id: Optional[int]
    created_at: datetime
    payment_flagged: bool = False


class OrderStatusChangeRequest(BaseModel):
    to_status: str
    comment: Optional[str] = None
    tracking_number: Optional[str] = None


@router.get("/orders", response_model=list[AdminOrderListItem])
def admin_list_orders(
    status: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1, limit: int = 50,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    q = db.query(Order)
    if status:
        q = q.filter(Order.status == status)
    if search:
        q = q.join(User).filter(
            (Order.number.ilike(f"%{search}%")) |
            (User.username.ilike(f"%{search}%"))
        )
    orders = q.order_by(Order.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
    result = []
    for o in orders:
        flagged = any(p.is_flagged for p in (o.payment.proofs if o.payment else []))
        result.append(AdminOrderListItem(
            id=o.id, number=o.number, status=o.status.value,
            total=float(o.total),
            user_telegram_id=o.user.telegram_id if o.user else None,
            created_at=o.created_at,
            payment_flagged=flagged,
        ))
    return result


@router.patch("/orders/{order_id}/status")
def admin_change_order_status(
    order_id: int,
    body: OrderStatusChangeRequest,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    try:
        to_status = OrderStatus(body.to_status)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid status")

    if body.tracking_number:
        order.tracking_number = body.tracking_number

    change_status(db, order, to_status, actor_type="admin", actor_id=admin.id, comment=body.comment)

    # Log
    db.add(AdminAuditLog(
        admin_id=admin.id, action="change_order_status",
        entity="orders", entity_id=order_id,
        diff={"to_status": body.to_status, "comment": body.comment},
    ))
    db.commit()
    return {"detail": "Status updated"}


@router.get("/orders/{order_id}")
def admin_get_order(
    order_id: int,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    from app.modules.orders.router import _order_to_out
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    out = _order_to_out(order).model_dump()
    out["user"] = {
        "id": order.user.id,
        "telegram_id": order.user.telegram_id,
        "username": order.user.username,
        "first_name": order.user.first_name,
        "last_name": order.user.last_name,
        "phone": order.user.phone,
    } if order.user else None
    if order.payment:
        out["payment"] = {
            "id": order.payment.id,
            "status": order.payment.status.value,
            "amount": float(order.payment.amount),
            "proofs": [get_file_url(p.file_key) for p in order.payment.proofs],
        }
    return out


# ─── Payment Review ───────────────────────────────────────────────────────────

class PaymentReviewOut(BaseModel):
    payment_id: int
    order_id: int
    order_number: str
    amount: float
    user_telegram_id: Optional[int]
    proof_url: Optional[str]
    is_flagged: bool
    status: str


class PaymentDecisionRequest(BaseModel):
    decision: str   # "approve" | "reject"
    reason: Optional[str] = None


@router.get("/payment-review", response_model=list[PaymentReviewOut])
def payment_review_queue(
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    payments = db.query(Payment).filter(Payment.status == PaymentStatus.review).all()
    result = []
    for pmt in payments:
        proof = pmt.proofs[-1] if pmt.proofs else None
        proof_url = get_file_url(proof.file_key) if proof else None
        result.append(PaymentReviewOut(
            payment_id=pmt.id,
            order_id=pmt.order_id,
            order_number=pmt.order.number,
            amount=float(pmt.amount),
            user_telegram_id=pmt.order.user.telegram_id if pmt.order.user else None,
            proof_url=proof_url,
            is_flagged=proof.is_flagged if proof else False,
            status=pmt.status.value,
        ))
    return result


@router.post("/payments/{payment_id}/decision")
def payment_decision(
    payment_id: int,
    body: PaymentDecisionRequest,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    if payment.status != PaymentStatus.review:
        raise HTTPException(status_code=400, detail="Payment is not in review status")

    now = datetime.now(timezone.utc)

    if body.decision == "approve":
        payment.status = PaymentStatus.approved
        payment.reviewed_by = admin.id
        payment.reviewed_at = now
        change_status(db, payment.order, OrderStatus.approved,
                       actor_type="admin", actor_id=admin.id, comment=body.reason)
    elif body.decision == "reject":
        if not body.reason:
            raise HTTPException(status_code=400, detail="Rejection reason required")
        payment.status = PaymentStatus.rejected
        payment.reject_reason = body.reason
        payment.reviewed_by = admin.id
        payment.reviewed_at = now
        change_status(db, payment.order, OrderStatus.payment_rejected,
                       actor_type="admin", actor_id=admin.id, comment=body.reason)
    else:
        raise HTTPException(status_code=400, detail="Decision must be 'approve' or 'reject'")

    db.add(AdminAuditLog(
        admin_id=admin.id, action=f"payment_{body.decision}",
        entity="payments", entity_id=payment_id,
        diff={"reason": body.reason},
    ))
    db.commit()
    return {"detail": f"Payment {body.decision}d"}


# ─── Products ─────────────────────────────────────────────────────────────────

class ProductIn(BaseModel):
    category_id: Optional[int] = None
    title_i18n: dict
    description_i18n: Optional[dict] = None
    base_price: float
    currency: str = "USD"
    shipping_fee: float = 0
    source_platform: Optional[str] = None
    source_url: Optional[str] = None
    source_price_cny: Optional[float] = None
    status: str = "active"
    image_url: Optional[str] = None


@router.post("/products", status_code=201)
def create_product(
    body: ProductIn,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    from app.core.models import ProductMedia, MediaKind
    data = body.model_dump()
    image_url = data.pop("image_url", None)
    product = Product(**data)
    db.add(product)
    db.flush()
    if image_url:
        db.add(ProductMedia(
            product_id=product.id,
            url=image_url,
            kind=MediaKind.gallery,
            sort_order=0
        ))
    db.commit()
    db.refresh(product)
    return {"id": product.id}


@router.patch("/products/{product_id}")
def update_product(
    product_id: int, body: ProductIn,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    from app.core.models import ProductMedia, MediaKind
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    data = body.model_dump(exclude_unset=True)
    image_url = data.pop("image_url", None)
    for k, v in data.items():
        setattr(product, k, v)
    if image_url is not None:
        if product.media:
            product.media[0].url = image_url
        else:
            db.add(ProductMedia(
                product_id=product.id,
                url=image_url,
                kind=MediaKind.gallery,
                sort_order=0
            ))
    db.commit()
    return {"detail": "Updated"}


@router.post("/products/{product_id}/media")
def upload_product_media(
    product_id: int,
    kind: str = "gallery",
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    from app.core.models import ProductMedia
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    file_bytes = file.file.read()
    file_key, _ = save_image(file_bytes, "products")

    count = len(product.media)
    media = ProductMedia(product_id=product_id, url=file_key, kind=kind, sort_order=count)
    db.add(media)
    db.commit()
    return {"url": get_file_url(file_key)}


@router.post("/products/bulk-status")
def bulk_status(
    product_ids: list[int],
    new_status: str,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    db.query(Product).filter(Product.id.in_(product_ids)).update(
        {"status": new_status}, synchronize_session=False
    )
    db.commit()
    return {"detail": "Updated"}


# ─── Settings ─────────────────────────────────────────────────────────────────

@router.get("/settings")
def get_settings(db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    rows = db.query(AppSetting).all()
    return {r.key: r.value for r in rows}


@router.put("/settings")
def update_settings(
    body: dict,
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_owner),
):
    for k, v in body.items():
        row = db.query(AppSetting).filter(AppSetting.key == k).first()
        if row:
            row.value = v
        else:
            db.add(AppSetting(key=k, value=v))
    db.commit()
    return {"detail": "Settings updated"}


# ─── Dashboard ───────────────────────────────────────────────────────────────

@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    from sqlalchemy import func
    from datetime import timedelta
    now = datetime.now(timezone.utc)

    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=7)
    month_start = today_start - timedelta(days=30)

    def count_orders(since):
        return db.query(func.count(Order.id)).filter(Order.created_at >= since).scalar()

    def revenue(since):
        val = db.query(func.sum(Order.total)).filter(
            Order.created_at >= since,
            Order.status.in_([OrderStatus.approved, OrderStatus.purchasing,
                               OrderStatus.warehouse, OrderStatus.shipping, OrderStatus.delivered])
        ).scalar()
        return float(val or 0)

    pending_reviews = db.query(func.count(Payment.id)).filter(
        Payment.status == PaymentStatus.review
    ).scalar()

    return {
        "orders_today": count_orders(today_start),
        "orders_week": count_orders(week_start),
        "orders_month": count_orders(month_start),
        "revenue_today": revenue(today_start),
        "revenue_month": revenue(month_start),
        "pending_payment_reviews": pending_reviews,
        "total_users": db.query(func.count(User.id)).scalar(),
    }


# ─── Categories / Catalog ───────────────────────────────────────────────────

class CategoryIn(BaseModel):
    parent_id: Optional[int] = None
    name_i18n: dict  # {"ru": "...", "uz": "...", "en": "..."}
    slug: str
    icon: Optional[str] = "📦"
    sort_order: int = 0
    is_active: bool = True


@router.get("/categories")
def admin_list_categories(db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    return db.query(Category).order_by(Category.sort_order).all()


@router.post("/categories", status_code=201)
def admin_create_category(
    body: CategoryIn,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    existing = db.query(Category).filter(Category.slug == body.slug).first()
    if existing:
        raise HTTPException(status_code=400, detail="Category with this slug already exists")
    cat = Category(**body.model_dump())
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@router.patch("/categories/{cat_id}")
def admin_update_category(
    cat_id: int,
    body: CategoryIn,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    cat = db.query(Category).filter(Category.id == cat_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(cat, k, v)
    db.commit()
    db.refresh(cat)
    return cat


@router.delete("/categories/{cat_id}")
def admin_delete_category(
    cat_id: int,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    cat = db.query(Category).filter(Category.id == cat_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    cat.is_active = not cat.is_active
    db.commit()
    return {"detail": "Status toggled", "is_active": cat.is_active}


# ─── Users Management ─────────────────────────────────────────────────────────

class UpdateUserRequest(BaseModel):
    is_blocked: Optional[bool] = None
    internal_note: Optional[str] = None


@router.get("/users")
def admin_list_users(
    search: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    q = db.query(User)
    if search:
        term = f"%{search}%"
        q = q.filter(
            (User.username.ilike(term)) |
            (User.first_name.ilike(term)) |
            (User.last_name.ilike(term)) |
            (User.phone.ilike(term)) |
            (cast(User.telegram_id, String).ilike(term))
        )
    users = q.order_by(User.created_at.desc()).offset((page - 1) * limit).limit(limit).all()

    result = []
    for u in users:
        orders = db.query(Order).filter(Order.user_id == u.id).all()
        spent = sum(
            float(o.total) for o in orders
            if o.status in [OrderStatus.approved, OrderStatus.purchasing, OrderStatus.warehouse, OrderStatus.shipping, OrderStatus.delivered]
        )
        result.append({
            "id": u.id,
            "telegram_id": u.telegram_id,
            "username": u.username,
            "first_name": u.first_name,
            "last_name": u.last_name,
            "language": u.language,
            "phone": u.phone,
            "is_blocked": u.is_blocked,
            "internal_note": u.internal_note,
            "created_at": u.created_at,
            "last_seen_at": u.last_seen_at,
            "orders_count": len(orders),
            "total_spent": spent,
        })
    return result


@router.patch("/users/{user_id}")
def admin_update_user(
    user_id: int,
    body: UpdateUserRequest,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    if body.is_blocked is not None:
        u.is_blocked = body.is_blocked
    if body.internal_note is not None:
        u.internal_note = body.internal_note
    db.commit()
    return {"detail": "User updated", "is_blocked": u.is_blocked, "internal_note": u.internal_note}
