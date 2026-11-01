# 🛍️ EasyBuy — Telegram Mini App E-Commerce Platform

A lightweight, high-performance Telegram Mini App storefront and ordering system designed for selling goods with $0/month infrastructure cost.

- **Frontend**: React 18, Vite, TypeScript, Zustand, TanStack Query, Vanilla CSS (Dark modern aesthetic).
- **Backend**: FastAPI, SQLite (WAL mode), SQLAlchemy, Python-Jose (JWT), Pillow (WebP optimization).
- **Deployment**: Free tier ready — PythonAnywhere (Backend) + Netlify (Frontend).

---

## ⚡ Quick Start (Local Development)

You will need **two terminal windows**: one for the backend and one for the frontend.

### 1️⃣ Backend Setup & Run

Open a terminal in the project root:

```powershell
cd backend

# 1. (Optional but recommended) Create and activate virtual environment:
python -m venv venv
.\venv\Scripts\activate   # On Windows PowerShell / CMD
# source venv/bin/activate  # On Linux / macOS

# 2. Install dependencies:
pip install -r requirements.txt

# 3. (Optional) Seed demo products, categories, payment methods & banners:
python seed_demo.py

# 4. Start the FastAPI development server:
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

- **API Base URL**: [http://localhost:8000](http://localhost:8000)
- **Interactive Swagger Docs**: [http://localhost:8000/api/docs](http://localhost:8000/api/docs)
- **Health Check**: [http://localhost:8000/health](http://localhost:8000/health)

---

### 2️⃣ Frontend Setup & Run

Open a **second** terminal window:

```powershell
cd frontend

# 1. Install dependencies:
npm install

# 2. Start Vite development server:
npm run dev
```

- **Frontend URL**: [http://localhost:5173](http://localhost:5173)

> 💡 **Note**: Vite is pre-configured to proxy `/api` and `/uploads` directly to `http://localhost:8000`, so API calls work out-of-the-box without extra CORS or `.env` configuration.

---

## 🔐 Default Admin Credentials

When the database is created, the initial admin account is automatically seeded:
- **Email**: `admin@easybuy.com`
- **Password**: `changeme123`

You can authenticate at `POST /api/v1/admin/login` or test all administrative endpoints directly via Swagger UI at [http://localhost:8000/api/docs](http://localhost:8000/api/docs).

---

## 🌐 Deploying for Free ($0/Month)

For step-by-step instructions on deploying the backend to **PythonAnywhere** and the frontend to **Netlify**, refer to:
👉 [DEPLOY.md](./DEPLOY.md)

---

## 📁 Project Structure

```
EasyBuy/
├── backend/
│   ├── app/
│   │   ├── core/         # Config, Database, Models, Security, Storage
│   │   └── modules/      # Auth, Catalog, Cart, Orders, Payments, Users, Admin, Bot
│   ├── uploads/          # Auto-created media storage (images, payment receipts)
│   ├── easybuy.db        # SQLite database
│   ├── seed_demo.py      # Seed script for demo catalog items
│   ├── scheduled_tasks.py# Background order cleanup & message delivery
│   ├── wsgi.py           # PythonAnywhere WSGI entrypoint
│   └── requirements.txt  # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── api/          # Axios HTTP client
│   │   ├── pages/        # Storefront pages (Home, Catalog, Product, Cart, Orders, etc.)
│   │   ├── store/        # Zustand state store
│   │   └── index.css     # Premium dark design system
│   ├── package.json      # Frontend dependencies & scripts
│   ├── vite.config.ts    # Vite bundler & reverse proxy config
│   └── netlify.toml      # Netlify deployment configuration
├── DEPLOY.md             # Free deployment guide (PythonAnywhere + Netlify)
└── README.md             # Project documentation
```
