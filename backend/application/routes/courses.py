"""
Course management API routes for the Examination Management Portal backend.

Includes course listing, creation, update and deletion endpoints.
"""

from flask import Blueprint, request, jsonify, session, g
from ..extensions import db, cache
from ..models import *
from .helpers import require_roles
from sqlalchemy import select
from datetime import datetime

course_bp = Blueprint('course', __name__)

# VIEW ALL THE COURSES (ADMIN AND STUDENT)
@course_bp.route('/all', methods=['GET'])
@require_roles('admin', 'student')
@cache.cached(timeout=300, key_prefix=lambda: f'all_courses_{session.get("user")["id"]}')  # Cache the result for 5 minutes
def all_courses():
    """
    Get all courses for admin and students.

    Returns:
        tuple: (response, status) with list of courses or forbidden error.
    """
    stmt = select(Course)
    courses = db.session.execute(stmt).unique().scalars().all()
    exports = [course.export('id', 'code', 'name', 'description', 'status') for course in courses]
    return jsonify({'courses': exports}), 200

# CREATE A NEW COURSE (ADMIN ONLY)
@course_bp.route('/create', methods=['POST'])
@require_roles('admin')
def create_course():
    """
    Create a new course (admin only).

    Args:
        None: Expects JSON body with code and name (and optional description/status).

    Returns:
        tuple: (response, status) with success message and course, or error response.
    """
    data = g.data
    if {'code', 'name'}.issubset(set(data.keys())) is False:
        return jsonify({'error': 'Missing required fields'}), 400
    
    code_string = data.get('code', '')
    name_string = data.get('name', '')
    description_string = data.get('description', '')
    status_string = data.get('status', 'active')

    code = code_string.strip().upper()
    name = name_string.strip()
    description = description_string.strip() if description_string else None
    status = status_string if status_string in set(enum_values(CourseStatus)) else CourseStatus.ACTIVE.value

    if not code or not name:
        return jsonify({'error': 'Course code and name are required'}), 400

    existing_course = db.session.scalar(
        select(Course).where(Course.code == code)
    )

    if existing_course:
        return jsonify({'error': 'Course with this code already exists'}), 409

    course = Course(code=code, name=name, description=description, status=CourseStatus(status))
    db.session.add(course)

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(e)
        return jsonify({'error': 'An error occurred while creating the course'}), 500

    exports = course.export('id', 'code', 'name', 'description', 'status')
    return jsonify({'message': 'Course created successfully', 'course': exports}), 201

# GET A SPECIFIC COURSE INFORMATION (ADMIN AND STUDENT)
@course_bp.route('/<int:course_id>', methods=['GET'])
@require_roles('admin', 'student')
@cache.cached(timeout=300, key_prefix=lambda: f'course_info_{request.view_args["course_id"]}')  # Cache the result for 5 minutes
def get_course(course_id):
    """
    Get a specific course by ID (admin and student).

    Args:
        course_id (int): ID of the course to fetch.

    Returns:
        tuple: (response, status) with course info or not found error.
    """
    course = db.session.get(Course, course_id)

    if not course:
        return jsonify({'error': 'Course not found'}), 404
    else:
        exports = course.export('id', 'code', 'name', 'description', 'status')
        return jsonify({'course_info': exports}), 200

# UPDATE A SPECIFIC COURSE INFORMATION (ADMIN ONLY)
@course_bp.route('/<int:course_id>', methods=['PATCH'])
@require_roles('admin')
def update_course(course_id):
    """
    Update a specific course by ID (admin only).

    Args:
        course_id (int): ID of the course to update.

    Returns:
        tuple: (response, status) with success message or error response.
    """
    course = db.session.get(Course, course_id)

    if not course:
        return jsonify({'error': 'Course not found'}), 404

    data = g.data
    code_string = data.get('code')
    name_string = data.get('name')
    description_string = data.get('description')
    status_string = data.get('status')

    if code_string is not None:
        code = code_string.strip().upper()
        if not code:
            return jsonify({'error': 'Course code cannot be empty'}), 400
        course.code = code

    if name_string is not None:
        name = name_string.strip()
        if not name:
            return jsonify({'error': 'Course name cannot be empty'}), 400
        course.name = name

    if description_string is not None:
        course.description = description_string.strip() if description_string else None

    if status_string is not None:
        if status_string not in set(enum_values(CourseStatus)):
            return jsonify({'error': 'Invalid status value'}), 400
        course.status = CourseStatus(status_string)

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(e)
        return jsonify({'error': 'An error occurred while updating the course'}), 500
    
    cache.delete(f'course_info_{course_id}')  # Invalidate the cache for this specific course
    return jsonify({'message': 'Course updated successfully'}), 200

# DELETE A SPECIFIC COURSE (ADMIN ONLY)
@course_bp.route('/<int:course_id>', methods=['DELETE'])
@require_roles('admin')
def delete_course(course_id):
    """
    Delete a specific course by ID (admin only).

    Args:
        course_id (int): ID of the course to delete.

    Returns:
        tuple: (response, status) with success message or error response.
    """
    course = db.session.get(Course, course_id)

    if not course:
        return jsonify({'error': 'Course not found'}), 404

    db.session.delete(course)

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(e)
        return jsonify({'error': 'An error occurred while deleting the course'}), 500
    
    cache.delete(f'course_info_{course_id}')  # Invalidate the cache for this specific course
    cache.delete('all_courses_1')  # Invalidate the cache for all courses
    return jsonify({'message': 'Course deleted successfully'}), 200
