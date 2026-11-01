"""
Flask application entry point for the Examination Management Portal backend.

Creates the Flask application instance (via the application factory) and
runs it in debug mode.

Can be started as a module from the repository root:

    python -m backend.app
"""

import os

from .application import create_app, celery

app = create_app()


if __name__ == '__main__':
    app.run(debug=True, port=int(os.getenv('FLASK_RUN_PORT', 5050)))
