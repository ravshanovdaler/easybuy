"""
Seed demo data for EasyBuy (Categories, Products, Options, Variants, Payment Methods, Banners)
Run: python seed_demo.py
"""
import os
import sys

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal, engine, Base
from app.core.models import (
    Category, Product, ProductMedia, ProductOption, ProductOptionValue,
    ProductVariant, PaymentMethod, Banner, ProductStatus, MediaKind
)
from app.main import create_tables, seed_initial_data

def seed():
    create_tables()
    seed_initial_data()
    db = SessionLocal()
    try:
        # Check if products already exist
        existing_count = db.query(Product).count()
        if existing_count > 0:
            print(f"Products already seeded ({existing_count} products found). Skipping.")
            return

        print("Seeding demo catalog...")

        # 1. Categories
        cat_elec = db.query(Category).filter_by(slug="electronics").first()
        if not cat_elec:
            cat_elec = Category(slug="electronics", name_i18n={"ru": "Электроника", "uz": "Elektronika"}, icon="📱", sort_order=1)
            db.add(cat_elec)
            db.flush()

        cat_cloth = db.query(Category).filter_by(slug="clothing").first()
        if not cat_cloth:
            cat_cloth = Category(slug="clothing", name_i18n={"ru": "Одежда и обувь", "uz": "Kiyim va poyabzal"}, icon="👕", sort_order=2)
            db.add(cat_cloth)
            db.flush()

        cat_sport = db.query(Category).filter_by(slug="sports").first()
        if not cat_sport:
            cat_sport = Category(slug="sports", name_i18n={"ru": "Спорт и отдых", "uz": "Sport va dam olish"}, icon="🏀", sort_order=3)
            db.add(cat_sport)
            db.flush()

        # 2. Products
        # Product 1: Wireless Earbuds Pro
        p1 = Product(
            category_id=cat_elec.id,
            title_i18n={"ru": "Беспроводные наушники Pro ANC", "uz": "Simsiz quloqchinlar Pro ANC"},
            description_i18n={
                "ru": "Превосходный звук, активное шумоподавление, до 30 часов работы с кейсом.",
                "uz": "Ajoyib ovoz, faol shovqinni bekor qilish, 30 soatgacha ishlash."
            },
            base_price=35.00,
            currency="USD",
            shipping_fee=2.50,
            status=ProductStatus.active,
            likes_count=18,
            sort_order=1
        )
        db.add(p1)
        db.flush()

        m1 = ProductMedia(
            product_id=p1.id,
            url="https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&q=80",
            kind=MediaKind.gallery,
            sort_order=1
        )
        db.add(m1)

        opt1 = ProductOption(product_id=p1.id, name_i18n={"ru": "Цвет", "uz": "Rang"}, sort_order=1)
        db.add(opt1)
        db.flush()

        val1_white = ProductOptionValue(option_id=opt1.id, value_i18n={"ru": "Белый", "uz": "Oq"}, sort_order=1)
        val1_black = ProductOptionValue(option_id=opt1.id, value_i18n={"ru": "Черный", "uz": "Qora"}, sort_order=2)
        db.add_all([val1_white, val1_black])
        db.flush()

        v1_1 = ProductVariant(product_id=p1.id, sku="EARBUD-WHT", option_value_ids=[val1_white.id], price=35.00)
        v1_2 = ProductVariant(product_id=p1.id, sku="EARBUD-BLK", option_value_ids=[val1_black.id], price=35.00)
        db.add_all([v1_1, v1_2])

        # Product 2: Smart Watch Ultra
        p2 = Product(
            category_id=cat_elec.id,
            title_i18n={"ru": "Смарт-часы Ultra Amoled", "uz": "Smart soat Ultra Amoled"},
            description_i18n={
                "ru": "Титановый корпус, яркий AMOLED дисплей, мониторинг здоровья и GPS.",
                "uz": "Titan korpus, yorqin AMOLED displey, salomatlik monitoringi va GPS."
            },
            base_price=52.00,
            currency="USD",
            shipping_fee=3.00,
            status=ProductStatus.active,
            likes_count=29,
            sort_order=2
        )
        db.add(p2)
        db.flush()

        m2 = ProductMedia(
            product_id=p2.id,
            url="https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80",
            kind=MediaKind.gallery,
            sort_order=1
        )
        db.add(m2)

        # Product 3: Oversized Hoodie
        p3 = Product(
            category_id=cat_cloth.id,
            title_i18n={"ru": "Худи Оверсайз Премиум Хлопок", "uz": "Oversize Xudi Premium Paxta"},
            description_i18n={
                "ru": "100% плотный хлопок, мягкий начес, свободный трендовый крой.",
                "uz": "100% qalin paxta, yumshoq astar, erkin zamonaviy bichim."
            },
            base_price=28.00,
            currency="USD",
            shipping_fee=2.00,
            status=ProductStatus.active,
            likes_count=12,
            sort_order=3
        )
        db.add(p3)
        db.flush()

        m3 = ProductMedia(
            product_id=p3.id,
            url="https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800&q=80",
            kind=MediaKind.gallery,
            sort_order=1
        )
        db.add(m3)

        # Product 4: Running Sneakers
        p4 = Product(
            category_id=cat_sport.id,
            title_i18n={"ru": "Беговые кроссовки AeroFlow", "uz": "Yugurish krossovkalari AeroFlow"},
            description_i18n={
                "ru": "Ультралегкая дышащая подошва, отличная амортизация для тренировок.",
                "uz": "Yengil va havo o'tkazuvchan taglik, ajoyib qulaylik."
            },
            base_price=45.00,
            currency="USD",
            shipping_fee=3.50,
            status=ProductStatus.active,
            likes_count=44,
            sort_order=4
        )
        db.add(p4)
        db.flush()

        m4 = ProductMedia(
            product_id=p4.id,
            url="https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80",
            kind=MediaKind.gallery,
            sort_order=1
        )
        db.add(m4)

        # 3. Payment Methods
        if db.query(PaymentMethod).count() == 0:
            pm1 = PaymentMethod(
                title="Банковский перевод (Карта / Uzcard / Humo)",
                details_text="Переведите на карту: 8600 0000 0000 0000 (Имя Получателя)\nПосле оплаты прикрепите квитанцию или скриншот.",
                is_active=True,
                sort_order=1
            )
            db.add(pm1)

        # 4. Banner
        if db.query(Banner).count() == 0:
            b1 = Banner(
                title_i18n={"ru": "Скидки до -40% на электронику!", "uz": "Elektronikaga -40% gacha chegirmalar!"},
                image_url="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=1200&q=80",
                link_url="/catalog?category=electronics",
                sort_order=1,
                is_active=True
            )
            db.add(b1)

        db.commit()
        print("Demo data seeded successfully! Added 4 products, banners, and payment methods.")
    except Exception as e:
        db.rollback()
        print(f"Error seeding demo data: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed()
