from datetime import datetime, timezone
from sqlalchemy import (
    Column, BigInteger, Integer, String, Boolean, Float, Numeric,
    DateTime, ForeignKey, Text, Enum as SAEnum, JSON
)
from sqlalchemy.orm import relationship
from app.core.database import Base
import enum


def utcnow():
    return datetime.now(timezone.utc)


# ─── Enums ───────────────────────────────────────────────────────────────────

class OrderStatus(str, enum.Enum):
    pending_payment  = "pending_payment"
    payment_review   = "payment_review"
    payment_rejected = "payment_rejected"
    approved         = "approved"
    purchasing       = "purchasing"
    warehouse        = "warehouse"
    shipping         = "shipping"
    delivered        = "delivered"
    cancelled        = "cancelled"
    expired          = "expired"

class PaymentStatus(str, enum.Enum):
    pending  = "pending"
    review   = "review"
    approved = "approved"
    rejected = "rejected"

class AdminRole(str, enum.Enum):
    owner   = "owner"
    manager = "manager"

class ProductStatus(str, enum.Enum):
    active  = "active"
    hidden  = "hidden"
    deleted = "deleted"

class MediaKind(str, enum.Enum):
    gallery     = "gallery"
    buyer_photo = "buyer_photo"


# ─── Models ──────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id            = Column(Integer, primary_key=True)
    telegram_id   = Column(BigInteger, unique=True, nullable=False, index=True)
    username      = Column(String(100), nullable=True)
    first_name    = Column(String(100), nullable=True)
    last_name     = Column(String(100), nullable=True)
    language      = Column(String(10), default="ru")
    phone         = Column(String(30), nullable=True)
    is_blocked    = Column(Boolean, default=False)
    internal_note = Column(Text, nullable=True)
    last_seen_at  = Column(DateTime(timezone=True), default=utcnow)
    created_at    = Column(DateTime(timezone=True), default=utcnow)
    updated_at    = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    addresses  = relationship("Address", back_populates="user", cascade="all, delete-orphan")
    cart_items = relationship("CartItem", back_populates="user", cascade="all, delete-orphan")
    orders     = relationship("Order", back_populates="user")
    favorites  = relationship("Favorite", back_populates="user", cascade="all, delete-orphan")


class Address(Base):
    __tablename__ = "addresses"

    id           = Column(Integer, primary_key=True)
    user_id      = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    recipient    = Column(String(200), nullable=False)
    phone        = Column(String(30), nullable=False)
    country      = Column(String(100), default="Uzbekistan")
    region       = Column(String(100), nullable=True)
    city         = Column(String(100), nullable=False)
    street       = Column(Text, nullable=False)
    postal_code  = Column(String(20), nullable=True)
    is_default   = Column(Boolean, default=False)
    created_at   = Column(DateTime(timezone=True), default=utcnow)

    user = relationship("User", back_populates="addresses")


class Category(Base):
    __tablename__ = "categories"

    id         = Column(Integer, primary_key=True)
    parent_id  = Column(Integer, ForeignKey("categories.id"), nullable=True)
    name_i18n  = Column(JSON, nullable=False)   # {"ru": "...", "uz": "..."}
    slug       = Column(String(100), unique=True, nullable=False)
    icon       = Column(String(10), nullable=True)   # emoji
    sort_order = Column(Integer, default=0)
    is_active  = Column(Boolean, default=True)

    products  = relationship("Product", back_populates="category")
    children  = relationship("Category", backref="parent", remote_side="Category.id")


class Product(Base):
    __tablename__ = "products"

    id                = Column(Integer, primary_key=True)
    category_id       = Column(Integer, ForeignKey("categories.id"), nullable=True)
    title_i18n        = Column(JSON, nullable=False)
    description_i18n  = Column(JSON, nullable=True)
    base_price        = Column(Numeric(12, 2), nullable=False)
    currency          = Column(String(10), default="USD")
    source_platform   = Column(String(50), nullable=True)   # admin-only
    source_url        = Column(Text, nullable=True)          # admin-only
    source_price_cny  = Column(Numeric(12, 2), nullable=True)  # admin-only
    shipping_fee      = Column(Numeric(12, 2), default=0)
    status            = Column(SAEnum(ProductStatus), default=ProductStatus.active)
    likes_count       = Column(Integer, default=0)
    sort_order        = Column(Integer, default=0)
    created_at        = Column(DateTime(timezone=True), default=utcnow)
    updated_at        = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    category  = relationship("Category", back_populates="products")
    media     = relationship("ProductMedia", back_populates="product", cascade="all, delete-orphan", order_by="ProductMedia.sort_order")
    options   = relationship("ProductOption", back_populates="product", cascade="all, delete-orphan")
    variants  = relationship("ProductVariant", back_populates="product", cascade="all, delete-orphan")
    favorites = relationship("Favorite", back_populates="product", cascade="all, delete-orphan")


class ProductMedia(Base):
    __tablename__ = "product_media"

    id              = Column(Integer, primary_key=True)
    product_id      = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    url             = Column(Text, nullable=False)
    kind            = Column(SAEnum(MediaKind), default=MediaKind.gallery)
    source_platform = Column(String(50), nullable=True)
    sort_order      = Column(Integer, default=0)

    product = relationship("Product", back_populates="media")


class ProductOption(Base):
    __tablename__ = "product_options"

    id         = Column(Integer, primary_key=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    name_i18n  = Column(JSON, nullable=False)   # {"ru": "Цвет", "uz": "Rang"}
    sort_order = Column(Integer, default=0)

    product = relationship("Product", back_populates="options")
    values  = relationship("ProductOptionValue", back_populates="option", cascade="all, delete-orphan")


class ProductOptionValue(Base):
    __tablename__ = "product_option_values"

    id         = Column(Integer, primary_key=True)
    option_id  = Column(Integer, ForeignKey("product_options.id", ondelete="CASCADE"), nullable=False)
    value_i18n = Column(JSON, nullable=False)
    image_url  = Column(Text, nullable=True)
    sort_order = Column(Integer, default=0)

    option = relationship("ProductOption", back_populates="values")


class ProductVariant(Base):
    __tablename__ = "product_variants"

    id               = Column(Integer, primary_key=True)
    product_id       = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    sku              = Column(String(100), nullable=True)
    option_value_ids = Column(JSON, nullable=False)   # [val_id, val_id, ...]
    price            = Column(Numeric(12, 2), nullable=False)
    image_url        = Column(Text, nullable=True)
    is_active        = Column(Boolean, default=True)

    product = relationship("Product", back_populates="variants")


class Favorite(Base):
    __tablename__ = "favorites"

    user_id    = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), primary_key=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    user    = relationship("User", back_populates="favorites")
    product = relationship("Product", back_populates="favorites")


class CartItem(Base):
    __tablename__ = "cart_items"

    id         = Column(Integer, primary_key=True)
    user_id    = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    variant_id = Column(Integer, ForeignKey("product_variants.id"), nullable=True)
    quantity   = Column(Integer, default=1)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    user    = relationship("User", back_populates="cart_items")
    product = relationship("Product")
    variant = relationship("ProductVariant")


class Order(Base):
    __tablename__ = "orders"

    id                  = Column(Integer, primary_key=True)
    number              = Column(String(20), unique=True, nullable=False)
    user_id             = Column(Integer, ForeignKey("users.id"), nullable=False)
    status              = Column(SAEnum(OrderStatus), default=OrderStatus.pending_payment)
    subtotal            = Column(Numeric(12, 2), nullable=False)
    shipping_fee        = Column(Numeric(12, 2), default=0)
    service_fee         = Column(Numeric(12, 2), default=0)
    total               = Column(Numeric(12, 2), nullable=False)
    address_snapshot    = Column(JSON, nullable=True)
    payment_deadline_at = Column(DateTime(timezone=True), nullable=True)
    tracking_number     = Column(String(100), nullable=True)
    cancel_reason       = Column(Text, nullable=True)
    created_at          = Column(DateTime(timezone=True), default=utcnow)
    updated_at          = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    user           = relationship("User", back_populates="orders")
    items          = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    status_history = relationship("OrderStatusHistory", back_populates="order", cascade="all, delete-orphan")
    payment        = relationship("Payment", back_populates="order", uselist=False)


class OrderItem(Base):
    __tablename__ = "order_items"

    id               = Column(Integer, primary_key=True)
    order_id         = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    product_id       = Column(Integer, ForeignKey("products.id"), nullable=True)
    variant_id       = Column(Integer, ForeignKey("product_variants.id"), nullable=True)
    title_snapshot   = Column(JSON, nullable=False)
    options_snapshot = Column(JSON, nullable=True)
    unit_price       = Column(Numeric(12, 2), nullable=False)
    quantity         = Column(Integer, nullable=False)

    order   = relationship("Order", back_populates="items")
    product = relationship("Product")
    variant = relationship("ProductVariant")


class OrderStatusHistory(Base):
    __tablename__ = "order_status_history"

    id          = Column(Integer, primary_key=True)
    order_id    = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    from_status = Column(SAEnum(OrderStatus), nullable=True)
    to_status   = Column(SAEnum(OrderStatus), nullable=False)
    actor_type  = Column(String(20), nullable=True)   # "customer" | "admin" | "system"
    actor_id    = Column(Integer, nullable=True)
    comment     = Column(Text, nullable=True)
    created_at  = Column(DateTime(timezone=True), default=utcnow)

    order = relationship("Order", back_populates="status_history")


class PaymentMethod(Base):
    __tablename__ = "payment_methods"

    id           = Column(Integer, primary_key=True)
    title        = Column(String(200), nullable=False)
    details_text = Column(Text, nullable=True)
    qr_image_url = Column(Text, nullable=True)
    is_active    = Column(Boolean, default=True)
    sort_order   = Column(Integer, default=0)


class Payment(Base):
    __tablename__ = "payments"

    id            = Column(Integer, primary_key=True)
    order_id      = Column(Integer, ForeignKey("orders.id"), unique=True, nullable=False)
    method_id     = Column(Integer, ForeignKey("payment_methods.id"), nullable=True)
    amount        = Column(Numeric(12, 2), nullable=False)
    status        = Column(SAEnum(PaymentStatus), default=PaymentStatus.pending)
    reviewed_by   = Column(Integer, ForeignKey("admins.id"), nullable=True)
    reviewed_at   = Column(DateTime(timezone=True), nullable=True)
    reject_reason = Column(Text, nullable=True)
    created_at    = Column(DateTime(timezone=True), default=utcnow)

    order        = relationship("Order", back_populates="payment")
    method       = relationship("PaymentMethod")
    proofs       = relationship("PaymentProof", back_populates="payment", cascade="all, delete-orphan")
    reviewer     = relationship("Admin", foreign_keys=[reviewed_by])


class PaymentProof(Base):
    __tablename__ = "payment_proofs"

    id          = Column(Integer, primary_key=True)
    payment_id  = Column(Integer, ForeignKey("payments.id", ondelete="CASCADE"), nullable=False)
    file_key    = Column(Text, nullable=False)   # local path relative to UPLOAD_DIR
    sha256      = Column(String(64), nullable=False, index=True)
    is_flagged  = Column(Boolean, default=False)
    uploaded_at = Column(DateTime(timezone=True), default=utcnow)

    payment = relationship("Payment", back_populates="proofs")


class Admin(Base):
    __tablename__ = "admins"

    id            = Column(Integer, primary_key=True)
    email         = Column(String(200), unique=True, nullable=False)
    password_hash = Column(String(500), nullable=False)
    role          = Column(SAEnum(AdminRole), default=AdminRole.manager)
    is_active     = Column(Boolean, default=True)
    created_at    = Column(DateTime(timezone=True), default=utcnow)


class AdminAuditLog(Base):
    __tablename__ = "admin_audit_log"

    id         = Column(Integer, primary_key=True)
    admin_id   = Column(Integer, ForeignKey("admins.id"), nullable=True)
    action     = Column(String(100), nullable=False)
    entity     = Column(String(100), nullable=True)
    entity_id  = Column(Integer, nullable=True)
    diff       = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    admin = relationship("Admin")


class AppSetting(Base):
    __tablename__ = "app_settings"

    key       = Column(String(100), primary_key=True)
    value     = Column(JSON, nullable=True)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class Banner(Base):
    __tablename__ = "banners"

    id         = Column(Integer, primary_key=True)
    image_url  = Column(Text, nullable=False)
    link_url   = Column(Text, nullable=True)
    title_i18n = Column(JSON, nullable=True)
    is_active  = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=utcnow)


class TelegramOutbox(Base):
    """Outbox table for reliable Telegram message delivery."""
    __tablename__ = "telegram_outbox"

    id         = Column(Integer, primary_key=True)
    chat_id    = Column(BigInteger, nullable=False)
    text       = Column(Text, nullable=False)
    reply_markup = Column(JSON, nullable=True)  # inline keyboard as dict
    sent       = Column(Boolean, default=False)
    attempts   = Column(Integer, default=0)
    error      = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    sent_at    = Column(DateTime(timezone=True), nullable=True)
