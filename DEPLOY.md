# EasyBuy — Deployment Guide
## 100% Free Hosting: PythonAnywhere (Backend) + Netlify (Frontend)

---

## 🗂 Project Structure
```
EasyBuy/
├── backend/         ← FastAPI app for PythonAnywhere
│   ├── app/
│   │   ├── core/        (config, database, models, security, storage, deps)
│   │   └── modules/     (auth, catalog, cart, orders, payments, users, admin, bot)
│   ├── uploads/         (local file storage — created automatically)
│   ├── wsgi.py          (PythonAnywhere entry point)
│   ├── scheduled_tasks.py
│   ├── requirements.txt
│   └── .env.example
└── frontend/        ← React Vite app for Netlify
    ├── src/
    │   ├── pages/       (7 pages)
    │   ├── api/         (axios client)
    │   ├── store/       (zustand)
    │   └── index.css    (design system)
    ├── netlify.toml
    └── .env.example
```

---

## 🐍 BACKEND — PythonAnywhere (Free Tier)

### Step 1: Create Account
- Go to https://www.pythonanywhere.com/registration/register/beginner/
- Sign up for a **free** account

### Step 2: Upload Files
In PythonAnywhere Bash console:
```bash
# Create project folder
mkdir -p ~/easybuy/backend
cd ~/easybuy/backend

# Upload your backend/ folder via Files tab, or use git:
git clone https://github.com/yourusername/easybuy.git .
# Then cd into backend/
```

### Step 3: Create Virtual Environment & Install Dependencies
```bash
cd ~/easybuy/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Step 4: Configure Environment
```bash
cp .env.example .env
nano .env
# Fill in:
#   BOT_TOKEN=your_telegram_bot_token
#   BOT_WEBHOOK_SECRET=some_random_string
#   JWT_SECRET=another_long_random_string
#   SECRET_KEY=another_random_string
#   FIRST_ADMIN_EMAIL=you@email.com
#   FIRST_ADMIN_PASSWORD=StrongPassword123
#   BASE_URL=https://yourusername.pythonanywhere.com
#   DATABASE_URL=sqlite:///./easybuy.db
#   UPLOAD_DIR=uploads
```

### Step 5: Configure WSGI
1. Go to **Web** tab → Add a new web app → Manual configuration → Python 3.10
2. In **WSGI configuration file**, replace contents with:
```python
import sys, os
project_home = '/home/yourusername/easybuy/backend'
if project_home not in sys.path:
    sys.path.insert(0, project_home)
os.environ['HOME'] = project_home
from dotenv import load_dotenv
load_dotenv(os.path.join(project_home, '.env'))
from a2wsgi import ASGIMiddleware
from app.main import app
application = ASGIMiddleware(app)
```
3. Under **Virtualenv**, set: `/home/yourusername/easybuy/backend/venv`
4. Under **Static files**:
   - URL: `/uploads/`
   - Directory: `/home/yourusername/easybuy/backend/uploads`

### Step 6: Reload & Test
- Click **Reload** in Web tab
- Visit: `https://yourusername.pythonanywhere.com/health`
- You should see: `{"status": "ok", ...}`
- API docs: `https://yourusername.pythonanywhere.com/api/docs`

### Step 7: Scheduled Tasks
In **Tasks** tab, add:
- **Daily task**: `source ~/easybuy/backend/venv/bin/activate && cd ~/easybuy/backend && python scheduled_tasks.py`

### Step 8: Register Telegram Webhook
```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://yourusername.pythonanywhere.com/bot/webhook&secret_token=<YOUR_BOT_WEBHOOK_SECRET>"
```

---

## 🌐 FRONTEND — Netlify (Free)

### Step 1: Create `.env` File
```bash
cd frontend/
cp .env.example .env
# Edit .env:
# VITE_API_URL=https://yourusername.pythonanywhere.com/api/v1
```

### Step 2: Build
```bash
npm install
npm run build
```

### Step 3: Deploy to Netlify
**Option A — Drag & Drop (easiest):**
1. Go to https://app.netlify.com
2. Drag the `frontend/dist/` folder onto the Netlify dashboard
3. Done! You get a free `*.netlify.app` URL

**Option B — Git Integration (recommended for updates):**
1. Push to GitHub
2. Connect repo on Netlify
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Add env variable: `VITE_API_URL=https://yourusername.pythonanywhere.com/api/v1`

### Step 4: Set Telegram Mini App URL
In BotFather:
- `/newapp` or edit existing → set URL to your Netlify URL

---

## 🔑 Admin Panel & Superuser Management

### Creating or Resetting an Admin Account on PythonAnywhere:
In your PythonAnywhere **Bash console**:
```bash
cd ~/easybuy/backend
source venv/bin/activate
python create_admin.py
```
Follow the interactive prompts to set email and password, or pass arguments:
```bash
python create_admin.py --email admin@example.com --password YourPasswordHere --role owner
```
> *Note: Roles are `owner` (full superuser privileges) and `manager`.*

### Accessing the Admin API:
The API includes a REST admin interface:
- Login: `POST /api/v1/admin/login` with `{"email": "...", "password": "..."}`
- Dashboard: `GET /api/v1/admin/dashboard`
- Orders: `GET /api/v1/admin/orders`
- Payment review: `GET /api/v1/admin/payment-review`
- Interactive Swagger UI: `https://yourusername.pythonanywhere.com/api/docs`

Use any REST client (Postman, Insomnia, or the Swagger UI at `/api/docs`).

---

## 💰 Cost Breakdown

| Service | Free Tier | Limits |
|---------|-----------|--------|
| PythonAnywhere | ✅ Free | 512MB disk, 1 web app, CPU quota |
| Netlify | ✅ Free | 100GB bandwidth/month, unlimited sites |
| SQLite | ✅ Free | Built into Python |
| File storage | ✅ Free | 512MB on PythonAnywhere disk |
| **Total** | **$0/month** | Good for 100–500 daily users |

---

## ⚡ Performance Tips

1. **Image optimization**: Already built-in (WebP conversion, max 1200px)
2. **Frontend**: Code-split by route, lazy loaded pages
3. **Caching**: TanStack Query caches all API responses (30s stale time)
4. **DB**: SQLite with WAL mode is fast for reads (add `?journal_mode=WAL` to DATABASE_URL if needed)

---

## 🚀 Upgrade Path (when you grow)

1. Move DB to **Neon** (free serverless PostgreSQL) — change `DATABASE_URL`
2. Move files to **Cloudflare R2** (free 10GB) — update `storage.py`
3. Move backend to **Railway** or **Fly.io** for always-on (no CPU quota)
