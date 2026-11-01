"""
Examination Management Portal backend package.

This module wires the Flask application together: it loads the configuration,
initializes the extensions, registers the API blueprints, creates the database
tables and seeds the initial admin user.
"""

from .config import Config
from .extensions import *
from .models import UserRoleName, User
from flask import Flask, request, jsonify, g
from sqlalchemy import select
from .routes import *
import os


PRESERVE_CASE_JSON_FIELDS = {
    'password',
}


def normalize_json_value(field_name, value):
    """
    Normalize a JSON request body value.

    Strips whitespace from strings and lowercases them (except for fields
    listed in PRESERVE_CASE_JSON_FIELDS, such as passwords).

    Args:
        field_name (str): Name of the field the value belongs to.
        value: Raw JSON value (str, dict, list or scalar).

    Returns:
        str | dict | list | object: Normalized value.
    """
    if value is None:
        return ''

    if isinstance(value, str):
        value = value.strip()
        if field_name not in PRESERVE_CASE_JSON_FIELDS:
            value = value.lower()
        return value

    if isinstance(value, dict):
        return {
            nested_key: normalize_json_value(nested_key, nested_value)
            for nested_key, nested_value in value.items()
        }

    if isinstance(value, list):
        return [normalize_json_value(field_name, item) for item in value]

    return value


def validate_json_body():
    """
    Validate that the incoming request body is JSON and store it in `g.data`.

    Only POST/PUT/PATCH requests are validated; logout is excluded from the
    JSON content-type requirement.

    Returns:
        flask.Response | None: A 415/400 error response when validation
        fails, otherwise None.
    """
    if request.method not in ("POST", "PUT", "PATCH"):
        return
    
    excluded_enpoints = ["auth.logout"]

    # Skip requests that don't expect JSON (e.g., file uploads)
    if not request.is_json:
        if request.endpoint in excluded_enpoints:
            return
        return jsonify({"error": "Content-Type must be application/json"}), 415

    data = request.get_json(silent=True)

    if data is None:
        return jsonify({"error": "Invalid JSON"}), 400

    if not isinstance(data, dict):
        return jsonify({"error": "JSON body must be an object"}), 400

    g.data = {
        key: normalize_json_value(key, value)
        for key, value in data.items()
    }

def create_database(app):
    """
    Create the database tables.

    Args:
        app (flask.Flask): Flask application instance holding the config.

    Returns:
        None: Creates the SQLite instance directory and runs db.create_all().
    """
    database_path = app.config.get('DATABASE_PATH', 'instance')
    instance_path = os.path.join(database_path, 'instance')
    os.makedirs(instance_path, exist_ok=True)
    with app.app_context():
        db.create_all()

def routes_register(app):
    """
    Register the API blueprints on the Flask app.

    Args:
        app (flask.Flask): Flask application instance.

    Returns:
        None: Registers all blueprints under their url prefixes and hooks
        the JSON body validation before-request handler.
    """
    app.register_blueprint(user_bp, url_prefix='/users')
    app.register_blueprint(auth_bp, url_prefix='/')
    app.register_blueprint(course_bp, url_prefix='/courses')
    app.register_blueprint(exam_bp, url_prefix='/examinations')
    app.register_blueprint(rubric_bp, url_prefix='/rubrics')
    app.register_blueprint(slot_bp, url_prefix='/slots')
    app.register_blueprint(booking_bp, url_prefix='/bookings')
    app.register_blueprint(evaluation_bp, url_prefix='/evaluations')
    app.register_blueprint(summary_bp, url_prefix='/summary')

    app.before_request(validate_json_body)  # Register the JSON validation function

def create_admin_user(app):
    """
    Create an admin user if it doesn't exist.

    The admin is created programmatically from the app configuration and no
    admin registration endpoint is exposed.

    Args:
        app (flask.Flask): Flask application instance holding the config.

    Returns:
        None: Creates and commits the default admin user when missing.
    """
    with app.app_context():
        stmt = select(User).where(User.role == UserRoleName.ADMIN)
        admin_user = db.session.execute(stmt).scalars().first()
        if not admin_user:
            admin_user = User(
                email=app.config['ADMIN_EMAIL'],
                first_name=app.config['ADMIN_FIRST_NAME'],
                last_name=app.config['ADMIN_LAST_NAME'],
                role=UserRoleName.ADMIN
            )
            admin_user.set_password(app.config['ADMIN_PASSWORD'])
            db.session.add(admin_user)
            db.session.commit()
        
# app setup
def create_app():
    # Use the 'backend' package as the Flask application root so that all
    # entry points (backend.app, backend.seed, ...) share the same instance
    # directory and database.
    app = Flask('backend')
    app.extended_config = Config  # Load configuration from config.py
    app.config.from_object(Config)  # Load configuration from config.py

    # Fail fast when the required mail credentials are not configured, so the
    # backend (e.g. the Docker image) does not start without a usable .env.
    if not app.config.get('MAIL_USERNAME') or not app.config.get('MAIL_PASSWORD'):
        raise RuntimeError(
            'Missing mail configuration: the MAIL_USERNAME and MAIL_PASSWORD entries are '
            'required. Set them in the environment or in backend/.env before starting the backend.'
        )

    # extensions setup
    init_extensions(app)
    init_celery(app)

    create_database(app)
    routes_register(app)
    create_admin_user(app)
    return app
