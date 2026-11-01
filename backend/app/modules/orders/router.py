"""Orders module: checkout, history, status, cancel"""
import string
import random
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.models import (
    Order, OrderItem, OrderStatus, OrderStatusHistory,
    CartItem, Payment, PaymentStatus, PaymentMethod, Address, User, AppSetting
)
from app.core.config import settings

router = APIRouter(prefix="/api/v1/orders", tags=["orders"])


def generate_order_number() -> str:
    return "EB" + "".join(random.choices(string.digits, k=8))


def get_setting(db: Session, key: str, default=None):
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    return row.value if row else default


# ─── Schemas ─────────────────────────────────────────────────────────────────

class CheckoutRequest(BaseModel):
    address_id: int
    payment_method_id: int
    note: Optional[str] = None


class OrderItemOut(BaseModel):
    product_id: Optional[int]
    title_snapshot: dict
    options_snapshot: Optional[dict]
    unit_price: float
    quantity: int


class StatusHistoryOut(BaseModel):
    from_status: Optional[str]
    to_status: str
    actor_type: Optional[str]
    comment: Optional[str]
    created_at: datetime


class OrderOut(BaseModel):
    id: int
    number: str
    status: str
    subtotal: float
    shipping_fee: float
    service_fee: float
    total: float
    payment_deadline_at: Optional[datetime]
    tracking_number: Optional[str]
    address_snapshot: Optional[dict]
    created_at: datetime
    items: list[OrderItemOut] = []
    status_history: list[StatusHistoryOut] = []


# ─── Order status machine ─────────────────────────────────────────────────────

ALLOWED_TRANSITIONS: dict[OrderStatus, list[OrderStatus]] = {
    OrderStatus.pending_payment:  [OrderStatus.payment_review, OrderStatus.cancelled, OrderStatus.expired],
    OrderStatus.payment_review:   [OrderStatus.approved, OrderStatus.payment_rejected],
    OrderStatus.payment_rejected: [OrderStatus.payment_review, OrderStatus.cancelled],
    OrderStatus.approved:         [OrderStatus.purchasing, OrderStatus.cancelled],
    OrderStatus.purchasing:       [OrderStatus.warehouse],
    OrderStatus.warehouse:        [OrderStatus.shipping],
    OrderStatus.shipping:         [OrderStatus.delivered],
    OrderStatus.delivered:        [],
    OrderStatus.cancelled:        [],
    OrderStatus.expired:          [],
}


def change_status(db: Session, order: Order, to_status: OrderStatus,
                   actor_type: str = "system", actor_id: int = None,
                   comment: str = None):
    allowed = ALLOWED_TRANSITIONS.get(order.status, [])
    if to_status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot transition from {order.status} to {to_status}"
        )
    history = OrderStatusHistory(
        order_id=order.id,
        from_status=order.status,
        to_status=to_status,
        actor_type=actor_type,
        actor_id=actor_id,
        comment=comment,
    )
    db.add(history)
    order.status = to_status
    db.commit()
    return order


# ─── Routes ──────────────────────────────────────────────────────────────────

@router.post("/checkout", response_model=OrderOut)
def checkout(
    body: CheckoutRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    cart_items = db.query(CartItem).filter(CartItem.user_id == user.id).all()
    if not cart_items:
        raise HTTPException(status_code=400, detail="Cart is empty")

    address = db.query(Address).filter(
        Address.id == body.address_id, Address.user_id == user.id
    ).first()
    if not address:
        raise HTTPException(status_code=404, detail="Address not found")

    method = db.query(PaymentMethod).filter(
        PaymentMethod.id == body.payment_method_id, PaymentMethod.is_active == True
    ).first()
    if not method:
        raise HTTPException(status_code=404, detail="Payment method not found")

    # Calculate totals
    service_fee_pct = float(get_setting(db, "service_fee_percent", settings.SERVICE_FEE_PERCENT))
    deadline_hours = int(get_setting(db, "payment_deadline_hours", settings.PAYMENT_DEADLINE_HOURS))

    subtotal = 0.0
    order_items = []
    for ci in cart_items:
        price = float(ci.variant.price) if ci.variant else float(ci.product.base_price)
        subtotal += price * ci.quantity

        options_snap = None
        if ci.variant and ci.variant.option_value_ids:
            options_snap = {"value_ids": ci.variant.option_value_ids}

        order_items.append(OrderItem(
            product_id=ci.product_id,
            variant_id=ci.variant_id,
            title_snapshot=ci.product.title_i18n,
            options_snapshot=options_snap,
            unit_price=price,
            quantity=ci.quantity,
        ))

    shipping_fee = float(get_setting(db, "shipping_fee", 0))
    service_fee = round(subtotal * service_fee_pct / 100, 2)
    total = subtotal + shipping_fee + service_fee

    address_snap = {
        "recipient": address.recipient,
        "phone": address.phone,
        "country": address.country,
        "city": address.city,
        "street": address.street,
        "region": address.region,
        "postal_code": address.postal_code,
    }

    # Generate unique order number
    number = generate_order_number()
    while db.query(Order).filter(Order.number == number).first():
        number = generate_order_number()

    order = Order(
        number=number,
        user_id=user.id,
        status=OrderStatus.pending_payment,
        subtotal=subtotal,
        shipping_fee=shipping_fee,
        service_fee=service_fee,
        total=total,
        address_snapshot=address_snap,
        payment_deadline_at=datetime.now(timezone.utc) + timedelta(hours=deadline_hours),
    )
    db.add(order)
    db.flush()

    for oi in order_items:
        oi.order_id = order.id
        db.add(oi)

    # Create payment record
    payment = Payment(order_id=order.id, method_id=method.id, amount=total)
    db.add(payment)

    # Record initial history
    history = OrderStatusHistory(
        order_id=order.id,
        from_status=None,
        to_status=OrderStatus.pending_payment,
        actor_type="customer",
        actor_id=user.id,
    )
    db.add(history)

    # Clear cart
    db.query(CartItem).filter(CartItem.user_id == user.id).delete()
    db.commit()
    db.refresh(order)

    return _order_to_out(order)


@router.get("", response_model=list[OrderOut])
def list_orders(
    page: int = 1, limit: int = 20,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    orders = db.query(Order).filter(Order.user_id == user.id)\
                .order_by(Order.created_at.desc())\
                .offset((page - 1) * limit).limit(limit).all()
    return [_order_to_out(o) for o in orders]


@router.get("/{order_id}", response_model=OrderOut)
def get_order(
    order_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    order = db.query(Order).filter(Order.id == order_id, Order.user_id == user.id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return _order_to_out(order)


@router.post("/{order_id}/cancel", status_code=200)
def cancel_order(
    order_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    order = db.query(Order).filter(Order.id == order_id, Order.user_id == user.id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status not in [OrderStatus.pending_payment, OrderStatus.payment_rejected]:
        raise HTTPException(status_code=400, detail="Cannot cancel order at this stage")
    change_status(db, order, OrderStatus.cancelled, actor_type="customer", actor_id=user.id)
    return {"detail": "Order cancelled"}


def _order_to_out(order: Order) -> OrderOut:
    return OrderOut(
        id=order.id,
        number=order.number,
        status=order.status.value,
        subtotal=float(order.subtotal),
        shipping_fee=float(order.shipping_fee or 0),
        service_fee=float(order.service_fee or 0),
        total=float(order.total),
        payment_deadline_at=order.payment_deadline_at,
        tracking_number=order.tracking_number,
        address_snapshot=order.address_snapshot,
        created_at=order.created_at,
        items=[
            OrderItemOut(
                product_id=i.product_id,
                title_snapshot=i.title_snapshot,
                options_snapshot=i.options_snapshot,
                unit_price=float(i.unit_price),
                quantity=i.quantity,
            )
            for i in order.items
        ],
        status_history=[
            StatusHistoryOut(
                from_status=h.from_status.value if h.from_status else None,
                to_status=h.to_status.value,
                actor_type=h.actor_type,
                comment=h.comment,
                created_at=h.created_at,
            )
            for h in sorted(order.status_history, key=lambda x: x.created_at)
        ],
    )
