"""
This blueprint handles all the routes related to examination slots, including creating, updating, deleting, and retrieving examination slot information.
"""

from flask import Blueprint, request, jsonify, session, g
from ..extensions import db, cache
from ..models import *
from .helpers import require_roles, require_assigned_examiner
from sqlalchemy import select
from datetime import datetime

slot_bp = Blueprint('slot', __name__)

# CREATE A NEW EXAMINATION SLOT (EXAMINER ONLY)
@slot_bp.route('/create', methods=['POST'])
@require_roles('examiner')
def create_slot():
    """
    Create a new examination slot for the assigned examination (examiner only).

    Args:
        None: Expects JSON body with examination_id, date, start_time, end_time and max_capacity.

    Returns:
        tuple: (response, status) with success message and slot info, or error response.
    """
    data = g.data
    examination_id = data.get('examination_id')
    examination_id_str = str(examination_id) if examination_id is not None else ''
    if not examination_id_str or not examination_id_str.isdigit() or int(examination_id_str) <= 0:
        return jsonify({'error': 'Invalid examination ID'}), 400

    examiner = session.get('user')
    examination = db.session.get(Examination, int(examination_id_str))
    if not examination:
        return jsonify({'error': 'Examination not found'}), 404

    if examination.examiner_id != examiner['id']:
        return jsonify({'error': 'Forbidden'}), 403

    if examination.status != ExaminationStatus.SLOT_CREATION:
        return jsonify({'error': 'Examinations slots can be created only during the slot creation period'}), 400

    now = datetime.now()
    if not (examination.slot_creation_start <= now <= examination.slot_creation_end):
        return jsonify({'error': 'Slot creation period is not open'}), 400

    slot_date_str = data.get('date')
    if not slot_date_str:
        return jsonify({'error': 'Examination date is required'}), 400
    slot_date = datetime.strptime(slot_date_str, '%Y-%m-%d').date()

    start_time_str = data.get('start_time')
    end_time_str = data.get('end_time')
    if not start_time_str or not end_time_str:
        return jsonify({'error': 'Start time and end time are required'}), 400
    start_time = datetime.strptime(start_time_str, '%H:%M').time()
    end_time = datetime.strptime(end_time_str, '%H:%M').time()
    if end_time <= start_time:
        return jsonify({'error': 'End time must be after start time'}), 400

    max_capacity = data.get('max_capacity')
    max_capacity_value = int(max_capacity) if max_capacity is not None else 1
    if max_capacity_value <= 0:
        return jsonify({'error': 'Maximum capacity must be greater than 0'}), 400

    meeting_link = data.get('meeting_link')

    slot = ExaminationSlot(
        examination_id=int(examination_id),
        examiner_id=examiner['id'],
        date=slot_date,
        start_time=start_time,
        end_time=end_time,
        max_capacity=max_capacity_value,
        available_seats=max_capacity_value,
        status=SlotStatus.AVAILABLE,
        meeting_link=meeting_link,
    )
    db.session.add(slot)

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(e)
        return jsonify({'error': 'An error occurred while creating the examination slot'}), 500

    slot.mark_full()
    return jsonify({'message': 'Examination slot created successfully', 'slot_info': slot.export()}), 201

# VIEW ALL THE EXAMINATION SLOTS (ADMIN AND EXAMINER)
@slot_bp.route('/all', methods=['GET'])
@require_roles('admin', 'examiner')
def all_slots():
    """
    Get all examination slots - all slots for admin, slots created by the examiner for examiner.

    Returns:
        tuple: (response, status) with list of slots or forbidden error.
    """
    current_user = session.get('user')

    if current_user['role'] == 'admin':
        slots = db.session.execute(select(ExaminationSlot)).unique().scalars().all()
    else:
        slots = db.session.execute(
            select(ExaminationSlot).where(ExaminationSlot.examiner_id == current_user['id'])
        ).unique().scalars().all()
    
    exports = [
        slot.export('id', 'examination_id', 'examiner_id', 'date', 'start_time', 'end_time', 'max_capacity', 'available_seats', 'status', 'meeting_link')
        for slot in slots
    ]
    return jsonify({'slots': exports}), 200

# GET ALL THE SLOTS OF A SPECIFIC EXAMINATION (ADMIN, ASSIGNED EXAMINER AND STUDENT)
@slot_bp.route('/examination/<int:examination_id>', methods=['GET'])
@require_roles('admin', 'examiner', 'student')
def get_examination_slots(examination_id):
    """
    Get all slots of a specific examination by ID (admin, assigned examiner and
    student - students need this to pick a slot to book).

    Args:
        examination_id (int): ID of the examination.

    Returns:
        tuple: (response, status) with list of slots or error response.
    """
    current_user = session.get('user')
    examination = db.session.get(Examination, examination_id)

    if not examination:
        return jsonify({'error': 'Examination not found'}), 404

    if current_user['role'] == 'examiner' and examination.examiner_id != current_user['id']:
        return jsonify({'error': 'Forbidden'}), 403

    slots = db.session.execute(
        select(ExaminationSlot).where(ExaminationSlot.examination_id == examination_id)
    ).unique().scalars().all()
    exports = [
        slot.export('id', 'examination_id', 'examiner_id', 'date', 'start_time', 'end_time', 'max_capacity', 'available_seats', 'status', 'meeting_link')
        for slot in slots
    ]
    return jsonify({'slots': exports}), 200

# VIEW THE STUDENTS BOOKED FOR THE SLOTS OF A SPECIFIC EXAMINATION (ADMIN AND ASSIGNED EXAMINER)
@slot_bp.route('/examination/<int:examination_id>/booked_students', methods=['GET'])
@require_roles('admin', 'examiner')
@require_assigned_examiner('examination_id')
def get_booked_students(examination_id):
    """
    Get all the students booked for the slots of a specific examination (admin and assigned examiner).

    Args:
        examination_id (int): ID of the examination.

    Returns:
        tuple: (response, status) with list of booked students or error response.
    """
    examination = db.session.get(Examination, examination_id)

    if not examination:
        return jsonify({'error': 'Examination not found'}), 404

    bookings = db.session.execute(
        select(Booking).where(
            Booking.examination_id == examination_id,
            Booking.status == BookingStatus.BOOKED,
        )
    ).unique().scalars().all()
    students = [booking.student for booking in bookings if booking.student is not None]
    exports = [
        student.export('id', 'email', 'first_name', 'last_name', 'role', 'department')
        for student in students
    ]
    return jsonify({'students': exports}), 200

# UPDATE A SPECIFIC EXAMINATION SLOT (EXAMINER ONLY, BEFORE STUDENT BOOKING BEGINS)
@slot_bp.route('/<int:slot_id>', methods=['PATCH'])
@require_roles('examiner')
def update_slot(slot_id):
    """
    Update a specific examination slot by ID (examiner only, before student booking begins).

    Args:
        slot_id (int): ID of the slot to update.

    Returns:
        tuple: (response, status) with success message and slot info, or error response.
    """
    data = g.data
    slot = db.session.get(ExaminationSlot, slot_id)

    if not slot:
        return jsonify({'error': 'Examination slot not found'}), 404

    examiner = session.get('user')
    examination = slot.examination

    if examination.examiner_id != examiner['id']:
        return jsonify({'error': 'Forbidden'}), 403

    if examination.status in (ExaminationStatus.BOOKING_OPEN, ExaminationStatus.CLOSED, ExaminationStatus.COMPLETED):
        return jsonify({'error': 'Examination slots cannot be updated after student booking begins'}), 400

    if data.get('date') is not None:
        slot.date = datetime.strptime(data.get('date'), '%Y-%m-%d').date()

    if data.get('start_time') is not None:
        slot.start_time = datetime.strptime(data.get('start_time'), '%H:%M').time()

    if data.get('end_time') is not None:
        slot.end_time = datetime.strptime(data.get('end_time'), '%H:%M').time()

    if data.get('max_capacity') is not None:
        max_capacity_value = int(data.get('max_capacity'))
        if max_capacity_value <= 0:
            return jsonify({'error': 'Maximum capacity must be greater than 0'}), 400
        if max_capacity_value < slot.available_seats:
            return jsonify({'error': 'Maximum capacity cannot be less than available seats'}), 400
        slot.max_capacity = max_capacity_value
        slot.available_seats = max_capacity_value

    if data.get('meeting_link') is not None:
        slot.meeting_link = data.get('meeting_link')

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(e)
        return jsonify({'error': 'An error occurred while updating the examination slot'}), 500

    return jsonify({'message': 'Examination slot updated successfully', 'slot_info': slot.export()}), 200

# DELETE A SPECIFIC EXAMINATION SLOT (EXAMINER ONLY, BEFORE STUDENT BOOKING BEGINS)
@slot_bp.route('/<int:slot_id>', methods=['DELETE'])
@require_roles('examiner')
def delete_slot(slot_id):
    """
    Delete a specific examination slot by ID (examiner only, before student booking begins).

    Args:
        slot_id (int): ID of the slot to delete.

    Returns:
        tuple: (response, status) with success message or error response.
    """
    slot = db.session.get(ExaminationSlot, slot_id)

    if not slot:
        return jsonify({'error': 'Examination slot not found'}), 404

    examiner = session.get('user')
    examination = slot.examination

    if examination.examiner_id != examiner['id']:
        return jsonify({'error': 'Forbidden'}), 403

    if examination.status in (ExaminationStatus.BOOKING_OPEN, ExaminationStatus.CLOSED, ExaminationStatus.COMPLETED):
        return jsonify({'error': 'Examination slots cannot be deleted after student booking begins'}), 400

    db.session.delete(slot)

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(e)
        return jsonify({'error': 'An error occurred while deleting the examination slot'}), 500

    cache.delete(f'examination_info_{slot.examination_id}')  # Invalidate the cache for this specific examination
    return jsonify({'message': 'Examination slot deleted successfully'}), 200
