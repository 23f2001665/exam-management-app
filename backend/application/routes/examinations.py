"""
Examination management API routes for the Examination Management Portal backend.

Includes examination CRUD, lifecycle status transitions, examiner assignment and
result publication endpoints.
"""

from flask import Blueprint, request, jsonify, session, g
from ..extensions import db, cache
from ..models import *
from .helpers import require_roles
from sqlalchemy import select
from datetime import datetime

exam_bp = Blueprint('exam', __name__)

# VIEW ALL THE EXAMINATIONS (ADMIN, EXAMINER AND STUDENT)
@exam_bp.route('/all', methods=['GET'])
@require_roles('admin', 'examiner', 'student')
@cache.cached(timeout=300, key_prefix=lambda: f'all_examinations_{session.get("user")["id"]}')  # Cache the result for 5 minutes
def all_examinations():
    """
    Get all examinations for admin, assigned examinations for examiner and available examinations for students.

    Returns:
        tuple: (response, status) with list of examinations or forbidden error.
    """
    current_user = session.get('user')

    if current_user['role'] == 'admin':
        stmt = select(Examination)
    elif current_user['role'] == 'examiner':
        stmt = select(Examination).where(Examination.examiner_id == current_user['id'])
    elif current_user['role'] == 'student':
        stmt = select(Examination).where(Examination.status == ExaminationStatus.BOOKING_OPEN)
    else:
        return jsonify({'error': 'Unauthorized access'}), 403
    
    examinations = db.session.execute(stmt).unique().scalars().all()
    exports = [examination.export('id', 'course_id', 'name', 'type', 'duration', 'max_marks', 'status', 'examiner_id', 'results_published') for examination in examinations]
    return jsonify({'examinations': exports}), 200

# GET A SPECIFIC EXAMINATION INFORMATION (ADMIN, EXAMINER AND STUDENT)
@exam_bp.route('/<int:examination_id>', methods=['GET'])
@require_roles('admin', 'examiner', 'student')
@cache.cached(timeout=300, key_prefix=lambda: f'examination_info_{request.view_args["examination_id"]}')  # Cache the result for 5 minutes
def get_examination(examination_id):
    """
    Get a specific examination by ID (admin, assigned examiner and student).

    Args:
        examination_id (int): ID of the examination to fetch.

    Returns:
        tuple: (response, status) with examination info or error response.
    """
    current_user = session.get('user')
    examination = db.session.get(Examination, examination_id)

    if current_user['role'] == 'examiner':
        if not examination or examination.examiner_id != current_user['id']:
            return jsonify({'error': 'Unauthorized access'}), 404
    
    if not examination:
        return jsonify({'error': 'Examination not found'}), 404
    else:
        exports = examination.export('id', 'course_id', 'name', 'type', 'duration', 'max_marks', 'status', 'examiner_id', 'results_published')
        return jsonify({'examination_info': exports}), 200

# CREATE A NEW EXAMINATION (ADMIN ONLY)
@exam_bp.route('/create', methods=['POST'])
@require_roles('admin')
def create_examination():
    """
    Create a new examination (admin only).

    Args:
        None: Expects JSON body with course_id, name, duration, max_marks,
        slot_creation_start, slot_creation_end, slot_booking_start and
        slot_booking_end (plus optional examiner_id).

    Returns:
        tuple: (response, status) with success message and examination info, or error response.
    """
    data = g.data
    if {'course_id', 'name', 'duration', 'max_marks', 'slot_creation_start', 'slot_creation_end', 'slot_booking_start', 'slot_booking_end'}.issubset(set(data.keys())) is False:
        return jsonify({'error': 'Missing required fields'}), 400
    
    course_id = data.get('course_id')
    course_id_str = str(course_id) if course_id is not None else ''
    if not course_id_str or not course_id_str.isdigit() or int(course_id_str) <= 0:
        return jsonify({'error': 'Invalid course ID'}), 400

    course = db.session.get(Course, int(course_id_str))
    if not course:
        return jsonify({'error': 'Course not found'}), 404

    name = data.get('name')
    if not name:
        return jsonify({'error': 'Examination name is required'}), 400

    exam_type = data.get('type') or ExaminationType.ASSESSMENT.value
    if exam_type not in set(enum_values(ExaminationType)):
        return jsonify({'error': 'Invalid examination type value'}), 400

    duration = int(data.get('duration') or 60)
    if duration <= 0:
        return jsonify({'error': 'Duration must be greater than 0'}), 400

    max_marks = data.get('max_marks')
    try:
        max_marks_value = float(max_marks) if max_marks is not None else 100.0
    except (ValueError, TypeError):
        return jsonify({'error': 'Invalid maximum marks value'}), 400
    if max_marks_value <= 0:
        return jsonify({'error': 'Maximum marks must be greater than 0'}), 400

    slot_creation_start = datetime.strptime(data.get('slot_creation_start'), '%Y-%m-%d %H:%M')
    slot_creation_end = datetime.strptime(data.get('slot_creation_end'), '%Y-%m-%d %H:%M')
    slot_booking_start = datetime.strptime(data.get('slot_booking_start'), '%Y-%m-%d %H:%M')
    slot_booking_end = datetime.strptime(data.get('slot_booking_end'), '%Y-%m-%d %H:%M')

    if not (slot_creation_start and slot_creation_end and slot_creation_start < slot_creation_end):
        return jsonify({'error': 'Slot creation start/end date time error'}), 400
    if not (slot_booking_start and slot_booking_end and slot_booking_start < slot_booking_end):
        return jsonify({'error': 'Slot booking start/end date time error'}), 400
    if not (slot_creation_end <= slot_booking_start):
        return jsonify({'error': 'Slot booking start must be after slot creation end'}), 400

    examiner_id = data.get('examiner_id')
    examiner_id = int(examiner_id) if examiner_id and str(examiner_id).isdigit() else None
    examiner = None
    if examiner_id:
        examiner = db.session.get(User, examiner_id)
        if not examiner or examiner.role != UserRoleName.EXAMINER:
            return jsonify({'error': 'Invalid examiner user'}), 400

    examination = Examination(
        course_id=int(course_id_str),
        name=name,
        type=ExaminationType(exam_type),
        duration=duration,
        max_marks=max_marks_value,
        slot_creation_start=slot_creation_start,
        slot_creation_end=slot_creation_end,
        slot_booking_start=slot_booking_start,
        slot_booking_end=slot_booking_end,
        status=ExaminationStatus.DRAFT,
        examiner_id=examiner_id,
    )
    db.session.add(examination)

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(e)
        return jsonify({'error': 'An error occurred while creating the examination'}), 500

    return jsonify({'message': 'Examination created successfully', 'examination_info': examination.export()}), 201

# UPDATE A SPECIFIC EXAMINATION INFORMATION (ADMIN ONLY)
@exam_bp.route('/<int:examination_id>', methods=['PATCH'])
@require_roles('admin')
def update_examination(examination_id):
    """
    Update a specific examination by ID (admin only).

    Args:
        examination_id (int): ID of the examination to update.

    Returns:
        tuple: (response, status) with success message or error response.
    """
    examination = db.session.get(Examination, examination_id)

    if not examination:
        return jsonify({'error': 'Examination not found'}), 404

    data = g.data
    name = data.get('name')
    if name:
        examination.name = name

    exam_type = data.get('type')
    if exam_type:
        if exam_type not in set(enum_values(ExaminationType)):
            return jsonify({'error': 'Invalid examination type value'}), 400
        examination.type = ExaminationType(exam_type)

    duration = data.get('duration')
    if duration:
        duration_value = int(duration)
        if duration_value <= 0:
            return jsonify({'error': 'Duration must be greater than 0'}), 400
        examination.duration = duration_value

    max_marks = data.get('max_marks')
    if max_marks:
        max_marks_value = float(max_marks)
        if max_marks_value <= 0:
            return jsonify({'error': 'Maximum marks must be greater than 0'}), 400
        examination.max_marks = max_marks_value

    slot_creation_start_str = data.get('slot_creation_start')
    slot_creation_end_str = data.get('slot_creation_end')
    slot_booking_start_str = data.get('slot_booking_start')
    slot_booking_end_str = data.get('slot_booking_end')

    if slot_creation_start_str:
        examination.slot_creation_start = datetime.strptime(slot_creation_start_str, '%Y-%m-%d %H:%M')
    if slot_creation_end_str:
        examination.slot_creation_end = datetime.strptime(slot_creation_end_str, '%Y-%m-%d %H:%M')
    if slot_booking_start_str:
        examination.slot_booking_start = datetime.strptime(slot_booking_start_str, '%Y-%m-%d %H:%M')
    if slot_booking_end_str:
        examination.slot_booking_end = datetime.strptime(slot_booking_end_str, '%Y-%m-%d %H:%M')

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(e)
        return jsonify({'error': 'An error occurred while updating the examination'}), 500
    
    cache.delete(f'examination_info_{examination_id}')  # Invalidate the cache for this specific examination
    cache.delete(f'all_examinations_{session.get("user")["id"]}')  # Invalidate the cache for all examinations for this user
    return jsonify({'message': 'Examination updated successfully'}), 200

# DELETE A SPECIFIC EXAMINATION (ADMIN ONLY)
@exam_bp.route('/<int:examination_id>', methods=['DELETE'])
@require_roles('admin')
def delete_examination(examination_id):
    """
    Delete a specific examination by ID (admin only).

    Args:
        examination_id (int): ID of the examination to delete.

    Returns:
        tuple: (response, status) with success message or error response.
    """
    examination = db.session.get(Examination, examination_id)

    if not examination:
        return jsonify({'error': 'Examination not found'}), 404

    db.session.delete(examination)

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(e)
        return jsonify({'error': 'An error occurred while deleting the examination'}), 500
    
    cache.delete(f'examination_info_{examination_id}')  # Invalidate the cache for this specific examination
    return jsonify({'message': 'Examination deleted successfully'}), 200

# UPDATE THE STATUS OF A SPECIFIC EXAMINATION (ADMIN ONLY)
@exam_bp.route('/<int:examination_id>/status', methods=['PATCH'])
@require_roles('admin')
def update_examination_status(examination_id):
    """
    Update the status of a specific examination by ID (admin only).

    Args:
        examination_id (int): ID of the examination to update.

    Returns:
        tuple: (response, status) with success message or error response.
    """
    examination = db.session.get(Examination, examination_id)

    if not examination:
        return jsonify({'error': 'Examination not found'}), 404

    data = g.data
    new_status = data.get('status')

    if new_status not in set(enum_values(ExaminationStatus)):
        return jsonify({'error': 'Invalid status value'}), 400

    allowed_transitions = {
        ExaminationStatus.DRAFT.value: [ExaminationStatus.SLOT_CREATION.value],
        ExaminationStatus.SLOT_CREATION.value: [ExaminationStatus.BOOKING_OPEN.value],
        ExaminationStatus.BOOKING_OPEN.value: [ExaminationStatus.CLOSED.value],
        ExaminationStatus.CLOSED.value: [ExaminationStatus.COMPLETED.value],
    }

    current_status = examination.status.value if hasattr(examination.status, 'value') else str(examination.status)

    if new_status == current_status:
        return jsonify({'message': 'Examination is already in the requested status'}), 200

    if new_status not in allowed_transitions.get(current_status, []):
        return jsonify({'error': 'Invalid status transition'}), 400

    if new_status == ExaminationStatus.SLOT_CREATION.value:
        examination.open_slot_creation()
    
    if new_status == ExaminationStatus.BOOKING_OPEN.value:
        examination.open_booking()
    
    if new_status == ExaminationStatus.CLOSED.value:
        examination.close()
    
    if new_status == ExaminationStatus.COMPLETED.value:
        examination.complete()

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(e)
        return jsonify({'error': 'An error occurred while updating the examination status'}), 500
    
    cache.delete(f'examination_info_{examination_id}')  # Invalidate the cache for this specific examination
    current_status_value = examination.status.value if hasattr(examination.status, 'value') else str(examination.status)
    return jsonify({'message': 'Examination status updated successfully', 'status': current_status_value}), 200

# ASSIGN AN EXAMINER TO A SPECIFIC EXAMINATION (ADMIN ONLY)
@exam_bp.route('/<int:examination_id>/assign_examiner', methods=['PATCH'])
@require_roles('admin')
def assign_examiner(examination_id):
    """
    Change the assigned examiner of a specific examination by ID (admin only).

    Args:
        examination_id (int): ID of the examination to reassign.

    Returns:
        tuple: (response, status) with success message or error response.
    """
    examination = db.session.get(Examination, examination_id)

    if not examination:
        return jsonify({'error': 'Examination not found'}), 404

    data = g.data
    new_examiner_id = data.get('examiner_id')

    if not new_examiner_id or not str(new_examiner_id).isdigit() or int(new_examiner_id) <= 0:
        return jsonify({'error': 'Invalid examiner ID'}), 400

    new_examiner = db.session.get(User, int(new_examiner_id))
    if not new_examiner or new_examiner.role != UserRoleName.EXAMINER:
        return jsonify({'error': 'Examiner not found or not an examiner'}), 404

    examination.examiner_id = int(new_examiner_id)

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(e)
        return jsonify({'error': 'An error occurred while assigning the examiner'}), 500
    
    cache.delete(f'examination_info_{examination_id}')  # Invalidate the cache for this specific examination
    return jsonify({'message': 'Examination examiner updated successfully'}), 200

# PUBLISH THE RESULTS OF A SPECIFIC EXAMINATION (ADMIN ONLY)
@exam_bp.route('/<int:examination_id>/publish_results', methods=['POST'])
@require_roles('admin')
def publish_results(examination_id):
    """
    Publish the results of a specific examination (admin only).

    Args:
        examination_id (int): ID of the examination whose results are published.

    Returns:
        tuple: (response, status) with success message or error response.
    """
    examination = db.session.get(Examination, examination_id)

    if not examination:
        return jsonify({'error': 'Examination not found'}), 404

    if examination.status != ExaminationStatus.COMPLETED:
        return jsonify({'error': 'Examination must be completed before results can be published'}), 400

    if examination.results_published:
        return jsonify({'message': 'Results already published'}), 200

    examination.results_published = True

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(e)
        return jsonify({'error': 'An error occurred while publishing the results'}), 500
    
    cache.delete(f'examination_info_{examination_id}')  # Invalidate the cache for this specific examination
    return jsonify({'message': 'Examination results published successfully'}), 200
