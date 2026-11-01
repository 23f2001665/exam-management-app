"""
Celery worker/beat entry point for the Examination Management Portal backend.

`celery -A application.celery worker` imports the `application` package
without ever calling `create_app()`, so the shared Celery instance never
receives its Redis broker/result-backend config or the Flask app-context
wrapper that tasks need for `db.session`, `current_app`, `render_template`,
etc. Run the worker/beat against this module instead, which creates the
Flask app (and therefore configures Celery) at import time.

    celery -A celery_worker.celery worker --loglevel=info
    celery -A celery_worker.celery beat --loglevel=info
"""

from application import create_app
from application.extensions import celery

create_app()

__all__ = ["celery"]
