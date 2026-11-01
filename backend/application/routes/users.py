"""
User management and examiner management API routes for the Examination
Management Portal backend.

Includes admin-only user management endpoints (list/get/update/deactivate/
activate users and create examiners).
"""

from flask import Blueprint, request, jsonify, session, g
from ..extensions import db, cache
from ..models import *
from .helpers import require_roles
from sqlalchemy import select

user_bp = Blueprint('users', __name__)

###########################################
# USER MANAGEMENT ROUTES (ADMIN ONLY)
###########################################

# GET ALL THE USERS (ADMIN ONLY)
@user_bp.route('/all')
@require_roles('admin')
def all_users():
    """
    Get all users (admin only).

    Returns:
        tuple: (response, status) with list of users or forbidden error.
    """
    stmt = select(User)
    users = db.session.execute(stmt).scalars().all()
    exports = [user.export('email', 'first_name', 'last_name', 'role', 'department') for user in users]
    return jsonify({'users': exports}), 200

# GET A SPECIFIC USER (ADMIN ONLY)
@user_bp.route('/<int:user_id>', methods=['GET'])
@require_roles('admin')
@cache.cached(timeout=300, key_prefix=lambda: f'user_info_{request.view_args["user_id"]}')  # Cache the result for 5 minutes
def get_user(user_id):
    """
    Get a specific user by ID (admin only).

    Args:
        user_id (int): ID of the user to fetch.

    Returns:
        tuple: (response, status) with user info or not found error.
    """
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    else:
        exports = user.export('email', 'first_name', 'last_name', 'role', 'department')
        return jsonify({'user_info': exports}), 200

# UPDATE A SPECIFIC USER (ADMIN ONLY)
@user_bp.route('/<int:user_id>', methods=['PATCH'])
@require_roles('admin')
def update_user(user_id):
    """
    Update a specific user's information (admin only).

    Args:
        user_id (int): ID of the user to update.

    Returns:
        tuple: (response, status) with success message or error response.
    """
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    data = g.data
    first_name = data.get('first_name')
    last_name = data.get('last_name')

    if first_name:
        user.first_name = first_name
    if last_name:
        user.last_name = last_name

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(e)
        return jsonify({'error': 'An error occurred while updating the user'}), 500
    
    cache.delete(f'user_info_{user_id}')  # Invalidate the cache for this specific user

    return jsonify({'message': 'User updated successfully'}), 200

# DEACTIVATE A SPECIFIC USER (ADMIN ONLY)
@user_bp.route('/<int:user_id>/deactivate', methods=['POST'])
@require_roles('admin')
def deactivate_user(user_id):
    """
    Deactivate a user (admin only).

    Args:
        user_id (int): ID of the user to deactivate.

    Returns:
        tuple: (response, status) with success message or error response.
    """
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    if user.is_admin:
        return jsonify({'error': 'Cannot deactivate an admin user'}), 403
    user.is_active = False

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(e)
        return jsonify({'error': 'An error occurred while deactivating the user'}), 500
    
    cache.delete(f'user_info_{user_id}')  # Invalidate the cache for this specific user
    return jsonify({'message': 'User deactivated successfully'}), 200

# ACTIVATE A SPECIFIC USER (ADMIN ONLY)
@user_bp.route('/<int:user_id>/activate', methods=['POST'])
@require_roles('admin')
def activate_user(user_id):
    """
    Activate a user (admin only).

    Args:
        user_id (int): ID of the user to activate.

    Returns:
        tuple: (response, status) with success message or error response.
    """
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    user.is_active = True

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(e)
        return jsonify({'error': 'An error occurred while activating the user'}), 500
    
    cache.delete(f'user_info_{user_id}')  # Invalidate the cache for this specific user
    return jsonify({'message': 'User activated successfully'}), 200

######################################################
# EXAMINER RELATED ROUTES (ADMIN ONLY)
######################################################

# CREATE A NEW EXAMINER (ADMIN ONLY)
@user_bp.route('/create_examiner', methods=['POST'])
@require_roles('admin')
def create_examiner():
    """
    Create a new examiner user only (admin only).

    Args:
        None: Expects JSON body with email, first_name, last_name, password and optionally department.

    Returns:
        tuple: (response, status) with success message and user, or error response.
    """
    data = g.data
    email_string = data.get('email')
    first_name = data.get('first_name')
    last_name = data.get('last_name')
    user = db.session.scalar(
        select(User).where(User.email == email_string)
    )
    if user:
        return jsonify({'error': 'User with this email already exists'}), 409
    
    user = User(
        email=email_string,
        first_name=first_name,
        last_name=last_name
    )
    user.set_password(data.get('password'))
    user.make_examiner(department=data.get('department'))
    db.session.add(user)

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(e)
        return jsonify({'error': 'An error occurred while creating the examiner'}), 500
    
    exports = user.export('email', 'first_name', 'last_name', 'role', 'department')
    return jsonify({'message': 'Examiner created successfully', 'user': exports}), 201
