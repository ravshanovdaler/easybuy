"""
Create or update an Admin / Superuser for EasyBuy.

Usage:
    python create_admin.py
    
Or non-interactively with arguments:
    python create_admin.py --email admin@example.com --password mysecretpass --role owner
"""
import sys
import os
import argparse
import getpass

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal, engine, Base
from app.core.models import Admin, AdminRole
from app.core.security import hash_password


def main():
    parser = argparse.ArgumentParser(description="Create or update an EasyBuy admin/superuser.")
    parser.add_argument("--email", help="Admin email address")
    parser.add_argument("--password", help="Admin password")
    parser.add_argument(
        "--role",
        choices=["owner", "manager"],
        default="owner",
        help="Admin role: 'owner' (full superuser privileges) or 'manager' (default: owner)",
    )
    args = parser.parse_args()

    # Ensure database tables exist
    Base.metadata.create_all(bind=engine)

    email = args.email
    if not email:
        email = input("Admin Email: ").strip()
    if not email:
        print("Error: Email cannot be empty.")
        sys.exit(1)

    password = args.password
    if not password:
        password = getpass.getpass("Password: ")
        password_confirm = getpass.getpass("Confirm Password: ")
        if password != password_confirm:
            print("Error: Passwords do not match.")
            sys.exit(1)

    if not password or len(password) < 6:
        print("Error: Password must be at least 6 characters.")
        sys.exit(1)

    role = args.role

    db = SessionLocal()
    try:
        existing = db.query(Admin).filter(Admin.email == email).first()
        if existing:
            print(f"Admin with email '{email}' already exists.")
            update = input("Do you want to update this admin's password and role? [y/N]: ").strip().lower()
            if update == "y":
                existing.password_hash = hash_password(password)
                existing.role = role
                existing.is_active = True
                db.commit()
                print(f"[SUCCESS] Updated admin '{email}' with role '{role}'!")
            else:
                print("Aborted.")
                sys.exit(0)
        else:
            new_admin = Admin(
                email=email,
                password_hash=hash_password(password),
                role=role,
                is_active=True,
            )
            db.add(new_admin)
            db.commit()
            print(f"[SUCCESS] Created superuser/admin '{email}' with role '{role}'!")
    except Exception as e:
        db.rollback()
        print(f"Error creating admin: {e}")
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()

