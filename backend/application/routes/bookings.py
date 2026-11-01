"""
In this blueprint we handle booking management functionalities. It includes endpoints for creating a booking, retrieving all bookings, retrieving a specific booking, cancelling a booking, and rescheduling a booking. The routes are protected based on user roles (student and admin) to ensure that only authorized users can access or modify booking information.
"""

from flask import Blueprint, request, jsonify, session, g
from ..extensions import db, cache
from ..models import *
from sqlalchemy import select
from .helpers import require_roles, require_assigned_examiner

booking_bp = Blueprint('booking', __name__)

# Create a new booking (student)
@booking_bp.route('/create', methods=['POST'])
@require_roles('student')
def create_booking():
    """
    Create a new booking (student only).

    Args:
        None: Expects JSON body with slot_id.

    Returns:
        tuple: (response, status) with success message and booking info, or error response.
    """
    data = g.data
    slot_id = data.get('slot_id')
    if not slot_id or not str(slot_id).isdigit() or int(slot_id) <= 0:
        return jsonify({'error': 'Invalid slot ID'}), 400
    slot = db.session.get(ExaminationSlot, int(slot_id))
    if not slot:
        return jsonify({'error': 'Examination slot not found'}), 404

    examination = slot.examination
    if examination.status != ExaminationStatus.BOOKING_OPEN:
        return jsonify({'error': 'Examinations are not open for booking'}), 400

    if slot.is_full or slot.available_seats <= 0:
        return jsonify({'error': 'Examination slot is full'}), 400

    student_id = session.get('user')['id']

    existing_booking_id = db.session.execute(
        select(Booking.id).where(
            Booking.examination_id == examination.id,
            Booking.student_id == student_id,
        ).with_for_update()
    ).scalar_one_or_none()

    if existing_booking_id:
        return jsonify({'error': 'You have already booked this examination'}), 400

    booking = Booking(
        examination_id=examination.id,
        slot_id=slot.id,
        student_id=student_id,
        status=BookingStatus.BOOKED,
    )
    slot.available_seats = slot.available_seats - 1
    if slot.available_seats <= 0:
        slot.status = SlotStatus.FULL

    db.session.add(booking)

    try:
        db.session.commit()

    except Exception as e:
        db.session.rollback()
        print(e)
        return jsonify({'error': 'An error occurred while creating the booking'}), 500

    return jsonify({'message': 'Booking created successfully', 'booking_info': booking.export()}), 201

# update status of a booking (student cancels the booking, admin reschedules the booking)
@booking_bp.route('/<int:booking_id>', methods=['PATCH'])
@require_roles('student', 'admin')
def update_booking(booking_id):
    """
    Update a specific booking by ID (student and admin).

    Args:
        booking_id (int): ID of the booking to update.

    Returns:
        tuple: (response, status) with success message and booking info, or error response.
    """
    current_user = session.get('user')
    booking = db.session.get(Booking, booking_id)

    if not booking:
        return jsonify({'error': 'Booking not found'}), 404

    if current_user['role'] == 'student':
        if booking.student_id != current_user['id']:
            return jsonify({'error': 'Unauthorized access'}), 403
    elif current_user['role'] == 'admin':
        # Admin can cancel or reassign via reschedule endpoint, only cancel allowed here
        pass
    else:
        return jsonify({'error': 'Forbidden'}), 403

    data = g.data
    status = data.get('status')

    if status == 'cancelled':
        if booking.status != BookingStatus.BOOKED:
            return jsonify({'error': 'Booking is not active'}), 400

        booking.cancel()

        slot = booking.slot
        if slot is not None and slot.status in (SlotStatus.AVAILABLE, SlotStatus.FULL):
            slot.available_seats = min(slot.available_seats + 1, slot.max_capacity)
            if slot.status == SlotStatus.FULL and slot.available_seats > 0:
                slot.status = SlotStatus.AVAILABLE

    elif status is not None:
        return jsonify({'error': 'Invalid status update'}), 400

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(e)
        return jsonify({'error': 'An error occurred while updating the booking'}), 500
    
    return jsonify({'message': 'Booking updated successfully', 'booking_info': booking.export()}), 200

# RESCHEDULE A SPECIFIC BOOKING (ADMIN ONLY)
@booking_bp.route('/<int:booking_id>/reschedule', methods=['POST'])
@require_roles('admin')
def reschedule_booking(booking_id):
    """
    Reschedule a specific booking by ID (admin only).

    Args:
        booking_id (int): ID of the booking to reschedule.

    Returns:
        tuple: (response, status) with success message and booking info, or error response.
    """
    booking = db.session.get(Booking, booking_id)

    if not booking:
        return jsonify({'error': 'Booking not found'}), 404

    data = g.data
    new_slot_id = data.get('slot_id')
    if not new_slot_id or not str(new_slot_id).isdigit() or int(new_slot_id) <= 0:
        return jsonify({'error': 'Invalid slot ID'}), 400

    new_slot = db.session.get(ExaminationSlot, int(new_slot_id))
    if not new_slot:
        return jsonify({'error': 'Examination slot not found'}), 404

    if new_slot.examination_id != booking.examination_id:
        return jsonify({'error': 'Booking can only be rescheduled within the same examination'}), 400

    if new_slot.status != SlotStatus.AVAILABLE:
        return jsonify({'error': 'New examination slot is not available'}), 400

    # Free the seat of the old slot
    old_slot = booking.slot
    if old_slot is not None and old_slot.status in (SlotStatus.AVAILABLE, SlotStatus.FULL):
        old_slot.available_seats = min(old_slot.available_seats + 1, old_slot.max_capacity)
        if old_slot.status == SlotStatus.FULL and old_slot.available_seats > 0:
            old_slot.status = SlotStatus.AVAILABLE

    booking.slot_id = new_slot.id
    booking.examination_id = new_slot.examination_id
    new_slot.available_seats = new_slot.available_seats - 1
    if new_slot.available_seats <= 0:
        new_slot.status = SlotStatus.FULL

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(e)
        return jsonify({'error': 'An error occurred while rescheduling the booking'}), 500

    return jsonify({'message': 'Booking rescheduled successfully', 'booking_info': booking.export()}), 200

# ALL THE BOOKINGS IN THE SYSTEM (ADMIN, EXAMINER AND STUDENT)
@booking_bp.route('/all', methods=['GET'])
@require_roles('admin', 'examiner', 'student')
def all_bookings():
    """
    Get all bookings for admin, examiner (for their assigned examinations) and student (own bookings).

    Returns:
        tuple: (response, status) with list of bookings or forbidden error.
    """
    current_user = session.get('user')

    if current_user['role'] == 'admin':
        bookings = db.session.execute(select(Booking)).unique().scalars().all()
    elif current_user['role'] == 'examiner':
        bookings = db.session.execute(
            select(Booking).join(ExaminationSlot, Booking.slot_id == ExaminationSlot.id).where(
                ExaminationSlot.examiner_id == current_user['id'],
                Booking.status == BookingStatus.BOOKED,
            )
        ).unique().scalars().all()
    elif current_user['role'] == 'student':
        bookings = db.session.execute(
            select(Booking).where(Booking.student_id == current_user['id'])
        ).unique().scalars().all()
    else:
        return jsonify({'error': 'Unauthorized access'}), 403

    exports = [booking.export('id', 'examination_id', 'slot_id', 'student_id', 'booking_date', 'status') for booking in bookings]
    return jsonify({'bookings': exports}), 200

# GET A SPECIFIC BOOKING INFORMATION (ADMIN, EXAMINER AND STUDENT)
@booking_bp.route('/<int:booking_id>', methods=['GET'])
@require_roles('admin', 'examiner', 'student')
def get_booking(booking_id):
    """
    Get a specific booking by ID (admin, examiner and student).

    Args:
        booking_id (int): ID of the booking to fetch.

    Returns:
        tuple: (response, status) with booking info or error response.
    """
    current_user = session.get('user')
    booking = db.session.get(Booking, booking_id)

    if not booking:
        return jsonify({'error': 'Booking not found'}), 404

    if current_user['role'] == 'examiner':
        slot = booking.slot
        if slot is None or slot.examiner_id != current_user['id']:
            return jsonify({'error': 'Unauthorized access'}), 403
    elif current_user['role'] == 'student':
        if booking.student_id != current_user['id']:
            return jsonify({'error': 'Unauthorized access'}), 403

    exports = booking.export('id', 'examination_id', 'slot_id', 'student_id', 'booking_date', 'status')
    return jsonify({'booking_info': exports}), 200

# GET ALL THE BOOKINGS FOR A SPECIFIC EXAMINATION (ADMIN AND ASSIGNED EXAMINER)
@booking_bp.route('/examination/<int:examination_id>', methods=['GET'])
@require_roles('admin', 'examiner')
@require_assigned_examiner('examination_id')
def get_examination_bookings(examination_id):
    """
    Get all bookings for a specific examination by ID (admin and assigned examiner).

    Args:
        examination_id (int): ID of the examination.

    Returns:
        tuple: (response, status) with list of bookings or error response.
    """
    examination = db.session.get(Examination, examination_id)

    if not examination:
        return jsonify({'error': 'Examination not found'}), 404

    bookings = db.session.execute(
        select(Booking).where(Booking.examination_id == examination.id)
    ).unique().scalars().all()
    exports = [booking.export('id', 'examination_id', 'slot_id', 'student_id', 'booking_date', 'status') for booking in bookings]
    return jsonify({'bookings': exports}), 200
