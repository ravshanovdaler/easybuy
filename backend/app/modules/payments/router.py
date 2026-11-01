"""Payments: upload proof, view methods"""
import hashlib
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.models import (
    Order, Payment, PaymentProof, PaymentMethod, PaymentStatus, OrderStatus, User
)
from app.core.storage import save_image, get_file_url
from app.modules.orders.router import change_status

router = APIRouter(prefix="/api/v1", tags=["payments"])

MAX_PROOF_SIZE = 10 * 1024 * 1024  # 10 MB


class PaymentMethodOut(BaseModel):
    id: int
    title: str
    details_text: Optional[str]
    qr_image_url: Optional[str]
    sort_order: int


class PaymentOut(BaseModel):
    id: int
    order_id: int
    amount: float
    status: str
    reject_reason: Optional[str]
    method: Optional[PaymentMethodOut]
    proof_uploaded: bool = False


@router.get("/payment-methods", response_model=list[PaymentMethodOut])
def list_payment_methods(db: Session = Depends(get_db)):
    methods = db.query(PaymentMethod)\
                 .filter(PaymentMethod.is_active == True)\
                 .order_by(PaymentMethod.sort_order).all()
    result = []
    for m in methods:
        qr = get_file_url(m.qr_image_url) if m.qr_image_url and not m.qr_image_url.startswith("http") else m.qr_image_url
        result.append(PaymentMethodOut(
            id=m.id, title=m.title,
            details_text=m.details_text,
            qr_image_url=qr,
            sort_order=m.sort_order,
        ))
    return result


@router.get("/orders/{order_id}/payment", response_model=PaymentOut)
def get_payment(
    order_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    order = db.query(Order).filter(Order.id == order_id, Order.user_id == user.id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    payment = order.payment
    if not payment:
        raise HTTPException(status_code=404, detail="Payment record not found")

    method_out = None
    if payment.method:
        m = payment.method
        qr = get_file_url(m.qr_image_url) if m.qr_image_url and not m.qr_image_url.startswith("http") else m.qr_image_url
        method_out = PaymentMethodOut(
            id=m.id, title=m.title, details_text=m.details_text,
            qr_image_url=qr, sort_order=m.sort_order
        )

    return PaymentOut(
        id=payment.id,
        order_id=order_id,
        amount=float(payment.amount),
        status=payment.status.value,
        reject_reason=payment.reject_reason,
        method=method_out,
        proof_uploaded=len(payment.proofs) > 0,
    )


@router.post("/orders/{order_id}/payment-proof", status_code=201)
def upload_payment_proof(
    order_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    order = db.query(Order).filter(Order.id == order_id, Order.user_id == user.id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.status not in [OrderStatus.pending_payment, OrderStatus.payment_rejected]:
        raise HTTPException(status_code=400, detail="Cannot upload proof in current status")

    # Validate file
    if file.content_type not in ["image/jpeg", "image/png", "image/webp"]:
        raise HTTPException(status_code=400, detail="Only JPEG/PNG/WebP images are allowed")

    file_bytes = file.file.read()
    if len(file_bytes) > MAX_PROOF_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")

    file_key, sha256 = save_image(file_bytes, "payment_proofs", ".webp")

    # Duplicate detection
    existing_proof = db.query(PaymentProof).filter(PaymentProof.sha256 == sha256).first()
    is_flagged = existing_proof is not None and existing_proof.payment.order_id != order_id

    payment = order.payment
    if not payment:
        raise HTTPException(status_code=404, detail="Payment record not found")

    proof = PaymentProof(
        payment_id=payment.id,
        file_key=file_key,
        sha256=sha256,
        is_flagged=is_flagged,
    )
    db.add(proof)

    payment.status = PaymentStatus.review
    change_status(db, order, OrderStatus.payment_review,
                   actor_type="customer", actor_id=user.id,
                   comment="Payment proof uploaded")

    return {"detail": "Proof uploaded", "flagged": is_flagged}
