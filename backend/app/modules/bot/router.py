"""
Telegram bot via webhook (aiogram 3).
/start → opens Mini App
Callback queries for payment approve/reject from admin group.
"""
import json
import hashlib
import hmac
from datetime import datetime, timezone

from fastapi import APIRouter, Request, HTTPException, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.config import settings

router = APIRouter(prefix="/bot", tags=["bot"])


def verify_webhook(request_secret: str) -> bool:
    return hmac.compare_digest(request_secret, settings.BOT_WEBHOOK_SECRET)


async def send_telegram_message(chat_id: int, text: str, reply_markup: dict = None):
    """Send Telegram message via Bot API."""
    import httpx
    payload = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
    if reply_markup:
        payload["reply_markup"] = reply_markup

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"https://api.telegram.org/bot{settings.BOT_TOKEN}/sendMessage",
            json=payload,
            timeout=10,
        )
    return resp.json()


def send_telegram_message_sync(chat_id: int, text: str, reply_markup: dict = None):
    """Sync version using httpx for non-async contexts."""
    import httpx
    payload = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
    if reply_markup:
        payload["reply_markup"] = reply_markup
    httpx.post(
        f"https://api.telegram.org/bot{settings.BOT_TOKEN}/sendMessage",
        json=payload,
        timeout=10,
    )


@router.post("/webhook")
async def bot_webhook(request: Request, db: Session = Depends(get_db)):
    # Verify secret
    secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token", "")
    if not verify_webhook(secret):
        raise HTTPException(status_code=403, detail="Forbidden")

    update = await request.json()

    # Handle /start command
    if "message" in update:
        msg = update["message"]
        text = msg.get("text", "")
        chat_id = msg["chat"]["id"]

        if text.startswith("/start"):
            mini_app_url = settings.FRONTEND_URL
            deep_link = text.replace("/start", "").strip()

            keyboard = {
                "inline_keyboard": [[{
                    "text": "🛍 Open EasyBuy",
                    "web_app": {"url": mini_app_url}
                }]]
            }
            await send_telegram_message(
                chat_id,
                f"👋 Welcome to <b>EasyBuy</b>!\nBuy products from China, delivered to you.",
                keyboard,
            )

    # Handle callback queries (Approve/Reject from admin group)
    if "callback_query" in update:
        cb = update["callback_query"]
        data = cb.get("data", "")
        from_user_id = cb["from"]["id"]
        callback_id = cb["id"]

        # Verify admin
        from app.core.models import Admin
        admin = db.query(Admin).filter(Admin.is_active == True).all()
        admin_tg_ids = []  # TODO: store admin telegram_ids in settings

        if data.startswith("approve_payment:") or data.startswith("reject_payment:"):
            parts = data.split(":")
            action = parts[0]
            payment_id = int(parts[1])

            from app.core.models import Payment, PaymentStatus, OrderStatus
            from app.modules.orders.router import change_status

            payment = db.query(Payment).filter(Payment.id == payment_id).first()
            if not payment:
                return {"ok": True}

            if payment.status != PaymentStatus.review:
                # Idempotent - already processed
                answer_url = f"https://api.telegram.org/bot{settings.BOT_TOKEN}/answerCallbackQuery"
                import httpx
                httpx.post(answer_url, json={"callback_query_id": callback_id, "text": "Already processed"})
                return {"ok": True}

            now = datetime.now(timezone.utc)
            if action == "approve_payment":
                payment.status = PaymentStatus.approved
                payment.reviewed_at = now
                change_status(db, payment.order, OrderStatus.approved,
                               actor_type="system", comment="Approved via Telegram")
                db.commit()
                # Notify customer
                await send_telegram_message(
                    payment.order.user.telegram_id,
                    f"✅ <b>Order #{payment.order.number}</b> payment approved!\nWe are now purchasing your items."
                )
            elif action == "reject_payment":
                payment.status = PaymentStatus.rejected
                payment.reject_reason = "Rejected via Telegram"
                payment.reviewed_at = now
                change_status(db, payment.order, OrderStatus.payment_rejected,
                               actor_type="system", comment="Rejected via Telegram")
                db.commit()
                await send_telegram_message(
                    payment.order.user.telegram_id,
                    f"❌ <b>Order #{payment.order.number}</b> payment was rejected.\nPlease upload a valid payment screenshot."
                )

        import httpx
        httpx.post(
            f"https://api.telegram.org/bot{settings.BOT_TOKEN}/answerCallbackQuery",
            json={"callback_query_id": callback_id, "text": "Done"},
            timeout=5,
        )

    return {"ok": True}


def notify_admin_group_payment(db: Session, order_id: int):
    """Notify admin Telegram group about new payment proof."""
    from app.core.models import Order, AppSetting
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        return

    setting = db.query(AppSetting).filter(AppSetting.key == "admin_group_chat_id").first()
    if not setting or not setting.value:
        return

    chat_id = int(setting.value)
    text = (
        f"💳 <b>Payment Review</b>\n"
        f"Order: <b>#{order.number}</b>\n"
        f"Amount: <b>{order.total} {order.payment.method.title if order.payment and order.payment.method else ''}</b>\n"
        f"Customer: @{order.user.username or order.user.first_name}"
    )
    keyboard = {
        "inline_keyboard": [[
            {"text": "✅ Approve", "callback_data": f"approve_payment:{order.payment.id}"},
            {"text": "❌ Reject", "callback_data": f"reject_payment:{order.payment.id}"},
        ]]
    }
    send_telegram_message_sync(chat_id, text, keyboard)


def notify_customer_status_change(db: Session, order_id: int, new_status: str, comment: str = None):
    """Notify customer about order status change via Telegram."""
    from app.core.models import Order
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order or not order.user:
        return

    status_messages = {
        "approved": "✅ Your payment has been approved! We are purchasing your items.",
        "purchasing": "🛒 We are purchasing your items from China.",
        "warehouse": "📦 Your items arrived at our warehouse and are being inspected.",
        "shipping": "🚚 Your order is on the way!",
        "delivered": "🎉 Your order has been delivered!",
        "cancelled": "❌ Your order has been cancelled.",
        "payment_rejected": "⚠️ Your payment was rejected. Please re-upload your payment screenshot.",
        "expired": "⏰ Your order has expired (payment deadline passed).",
    }

    msg = status_messages.get(new_status, f"Order #{order.number} status: {new_status}")
    if comment:
        msg += f"\n\nNote: {comment}"

    try:
        send_telegram_message_sync(order.user.telegram_id, f"<b>Order #{order.number}</b>\n{msg}")
    except Exception:
        pass  # Don't fail the request if notification fails
