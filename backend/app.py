"""
Flask application entry point for the Examination Management Portal backend.

Creates the Flask application instance (via the application factory) and
runs it in debug mode.
"""

from application import create_app, celery
app = create_app()


if __name__ == '__main__':
    app.run(debug=True)
