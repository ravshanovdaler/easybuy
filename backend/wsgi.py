"""
PythonAnywhere WSGI entry point.
In PythonAnywhere dashboard → WSGI configuration file, point to this.
"""
import sys
import os

# Add project root to path
project_home = '/home/yourusername/easybuy/backend'
if os.path.exists(project_home):
    os.chdir(project_home)
if project_home not in sys.path:
    sys.path.insert(0, project_home)

# Load .env
from dotenv import load_dotenv
load_dotenv(os.path.join(project_home, '.env'))

from app.core.wsgi_adapter import make_sync_wsgi_app
from app.main import app

application = make_sync_wsgi_app(app)
