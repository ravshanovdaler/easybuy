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

from a2wsgi import ASGIMiddleware
from app.main import app

application = ASGIMiddleware(app)
