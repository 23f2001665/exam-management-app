"""
Route helper decorators for the Examination Management Portal backend.

Provides role-based access control and examination-assignment based
authorization helpers for API views.
"""

import datetime
from functools import wraps
from flask import session, jsonify
from ..extensions import db
from ..models import Examination

def require_roles(*allowed_roles):
    """
    Decorator factory creating a route decorator that checks the role of the
    logged-in user against the allowed roles.

    Args:
        *allowed_roles (str): Allowed role values (e.g. "admin", "examiner").

    Returns:
        Callable: Decorator that enforces the role check and calls the view.
    """
    def decorator(view):
        @wraps(view)
        def wrapper(*args, **kwargs):
            user = session.get("user")

            if user is None:
                return jsonify({"message": "Login required"}), 401

            if user["role"] not in allowed_roles:
                return jsonify({"message": "Forbidden"}), 403

            return view(*args, **kwargs)

        return wrapper
    return decorator

# path parameter can be used as kwargs in the view function, so we can access it using kwargs.get("examination_id")
def require_assigned_examiner(param_name):
    """
    Decorator factory creating a route decorator that authorizes the logged-in
    user as admin or as the examiner assigned to the examination.

    Args:
        param_name (str): Name of the path parameter holding the examination ID.

    Returns:
        Callable: Decorator that enforces the assignment check and calls the view.
    """
    def decorator(view):
        @wraps(view)
        def wrapper(*args, **kwargs):
            user = session.get("user")

            if user is None:
                return jsonify({"message": "Login required"}), 401

            if user["role"] not in ("admin", "examiner"):
                return jsonify({"message": "Forbidden"}), 403

            examination_id = kwargs.get(param_name)
            if examination_id is None:
                return jsonify({"message": "Examination ID is required"}), 400

            examination = db.session.get(Examination, examination_id)
            if examination is None:
                return jsonify({"message": "Examination not found"}), 404

            if user["role"] == "examiner" and examination.examiner_id != user["id"]:
                return jsonify({"message": "Forbidden"}), 403

            return view(*args, **kwargs)

        return wrapper
    return decorator
