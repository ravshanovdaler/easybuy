"""
Scheduled jobs for PythonAnywhere.
Set these up in PythonAnywhere → Tasks tab:
  - expire_orders.py → Every hour (or use a cron every minute for paid plans)
  - flush_outbox.py  → Not needed (notifications sent inline)
Run manually: python scheduled_tasks.py
"""
from datetime import datetime, timezone
from app.core.database import SessionLocal
from app.core.models import Order, OrderStatus, OrderStatusHistory


def expire_orders():
    """Expire orders that passed payment deadline."""
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        expired_orders = db.query(Order).filter(
            Order.status == OrderStatus.pending_payment,
            Order.payment_deadline_at <= now,
        ).all()

        for order in expired_orders:
            history = OrderStatusHistory(
                order_id=order.id,
                from_status=order.status,
                to_status=OrderStatus.expired,
                actor_type="system",
                comment="Payment deadline passed",
            )
            db.add(history)
            order.status = OrderStatus.expired

        db.commit()
        print(f"[{now.isoformat()}] Expired {len(expired_orders)} orders")
    finally:
        db.close()


def cleanup_abandoned_carts():
    """Remove cart items older than 60 days."""
    from datetime import timedelta
    from app.core.models import CartItem

    db = SessionLocal()
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(days=60)
        deleted = db.query(CartItem).filter(CartItem.updated_at <= cutoff).delete()
        db.commit()
        print(f"Cleaned up {deleted} abandoned cart items")
    finally:
        db.close()


if __name__ == "__main__":
    print("Running scheduled tasks...")
    expire_orders()
    cleanup_abandoned_carts()
    print("Done.")
