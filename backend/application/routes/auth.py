"""
Authentication related API routes for the Examination Management Portal backend.

Handles login, logout, registration and the logged-in user info retrieval and
update endpoints.
"""

from flask import Blueprint, request, jsonify, session, g
from sqlalchemy import select
from ..extensions import db, cache
from ..models import *

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['POST'])
def login():
    """
    Authenticate a user and create a session for the logged-in user.

    Args:
        None: Expects JSON body with email and password.

    Returns:
        tuple: (response, status) with user info on success, or an error response.
    """
    data = g.data
    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400

    user = db.session.scalar(
        select(User).where(User.email == email)
    )

    if not user or not user.check_password(password):
        return jsonify({'error': 'Invalid email or password'}), 401
    
    if not user.is_active:
        return jsonify({'error': 'User account is inactive'}), 403
    
    session.clear()
    session['user'] = {
        'id': user.id,
        'email': user.email,
        'role': user.role.value,
    }
    exports = user.export('email', 'first_name', 'last_name', 'role', 'department')
    return jsonify({'message': 'Login successful', 'user_info': exports}), 200

@auth_bp.route('/logout', methods=['POST'])
def logout():
    """
    Clear the session and logout the logged-in user.

    Returns:
        tuple: (response, status) with success message or not authenticated error.
    """
    if 'user' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    session.clear()
    return jsonify({'message': 'Logout successful'}), 200

@auth_bp.route('/register', methods=['POST'])
def register():
    """
    Register a new student user only.

    Args:
        None: Expects JSON body with email, password and first_name.

    Returns:
        tuple: (response, status) with success message and user info, or error response.
    """
    data = g.data
    email = data.get('email')
    password = data.get('password')
    first_name = data.get('first_name')
    last_name = data.get('last_name')

    if not email or not password or not first_name:
        return jsonify({'error': 'Email, password, and first name are required'}), 400

    existing_user = db.session.scalar(
        select(User).where(User.email == email)
    )

    if existing_user:
        return jsonify({'error': 'Email already registered'}), 409
    
    new_user = User(email=email, first_name=first_name, last_name=last_name)
    new_user.set_password(password)
    db.session.add(new_user)
    
    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(e)
        return jsonify({'error': 'An error occurred while registering the user'}), 500

    exports = new_user.export('email', 'first_name', 'last_name', 'role', 'department')
    return jsonify({'message': 'Registration successful', 'user_info': exports}), 201

@auth_bp.route('/user_info', methods=['GET'])
def get_user_info():
    """
    Get the logged-in user's information.

    Returns:
        tuple: (response, status) with user info or not authenticated error.
    """
    user = session.get('user')
    if not user:
        return jsonify({'error': 'Not authenticated'}), 401

    user_id = user['id']
    user = db.session.get(User, user_id)

    if not user:
        return jsonify({'error': 'User not found'}), 404

    exports = user.export('email', 'first_name', 'last_name', 'role', 'department')
    return jsonify({'user_info': exports}), 200

@auth_bp.route('/user_info', methods=['PATCH'])
def update_user_info():
    """
    Update the logged-in user's first and last name.

    Args:
        None: Expects JSON body with first_name and/or last_name.

    Returns:
        tuple: (response, status) with success message and user info, or error response.
    """
    user = session.get('user')
    if not user:
        return jsonify({'error': 'Not authenticated'}), 401

    user_id = user['id']
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
        return jsonify({'error': 'An error occurred while updating the user info'}), 500

    cache.delete(f'user_info_{user_id}')  # Invalidate the cache for this specific user

    exports = user.export('email', 'first_name', 'last_name', 'role', 'department')
    return jsonify({'message': 'User info updated successfully', 'user_info': exports}), 200
