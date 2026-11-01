"""
In this blueprint we handle evaluation management functionalities. It includes endpoints for submitting an evaluation, retrieving pending evaluations, retrieving all evaluations, and retrieving the evaluations of a specific examination. The routes are protected based on user roles (examiner and admin) to ensure that only authorized users can access or modify evaluation information.
"""

from flask import Blueprint, request, jsonify, session, g
from ..extensions import db, cache
from ..models import *
from .helpers import require_roles, require_assigned_examiner
from sqlalchemy import select

evaluation_bp = Blueprint('evaluation', __name__)

# SUBMIT AN EVALUATION (EXAMINER ONLY)
@evaluation_bp.route('/create', methods=['POST'])
@require_roles('examiner')
def create_evaluation():
    """
    Submit an evaluation for a booking (examiner only).

    Args:
        None: Expects JSON body with booking_id, total_marks and remarks.

    Returns:
        tuple: (response, status) with success message and evaluation info, or error response.
    """
    data = g.data
    booking_id = data.get('booking_id')
    if not booking_id or not str(booking_id).isdigit() or int(booking_id) <= 0:
        return jsonify({'error': 'Invalid booking ID'}), 400

    booking = db.session.get(Booking, int(booking_id))
    if not booking:
        return jsonify({'error': 'Booking not found'}), 404

    examiner = session.get('user')
    if booking.slot is None or booking.slot.examiner_id != examiner['id']:
        return jsonify({'error': 'Forbidden'}), 403

    if booking.status != BookingStatus.BOOKED:
        return jsonify({'error': 'Booking is not active'}), 400

    total_marks = data.get('total_marks')
    try:
        total_marks_value = float(total_marks) if total_marks is not None else 0.0
    except (ValueError, TypeError):
        return jsonify({'error': 'Invalid total marks value'}), 400
    if total_marks_value < 0:
        return jsonify({'error': 'Total marks cannot be negative'}), 400

    remarks = data.get('remarks')

    evaluation = Evaluation(
        booking_id=booking.id,
        student_id=booking.student_id,
        examiner_id=examiner['id'],
        total_marks=total_marks_value,
        remarks=remarks,
        status=EvaluationStatus.SUBMITTED,
    )
    booking.status = BookingStatus.COMPLETED

    db.session.add(evaluation)

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(e)
        return jsonify({'error': 'An error occurred while submitting the evaluation'}), 500

    return jsonify({'message': 'Evaluation submitted successfully', 'evaluation_info': evaluation.export()}), 201

# GET THE PENDING EVALUATIONS OF THE ASSIGNED EXAMINATIONS (EXAMINER ONLY)
@evaluation_bp.route('/pending', methods=['GET'])
@require_roles('examiner')
def pending_evaluations():
    """
    Get the pending evaluations for the examinations assigned to the logged-in examiner.

    Returns:
        tuple: (response, status) with list of pending evaluations or forbidden error.
    """
    examiner_id = session.get('user')['id']

    evaluations = db.session.execute(
        select(Evaluation)
        .join(Booking, Evaluation.booking_id == Booking.id)
        .join(ExaminationSlot, Booking.slot_id == ExaminationSlot.id)
        .where(
            Evaluation.examiner_id == examiner_id,
            Evaluation.status == EvaluationStatus.PENDING,
            Booking.status == BookingStatus.BOOKED,
        )
    ).unique().scalars().all()

    exports = [
        evaluation.export('id', 'booking_id', 'student_id', 'examiner_id', 'total_marks', 'remarks', 'evaluation_date', 'status')
        for evaluation in evaluations
    ]
    return jsonify({'evaluations': exports}), 200

# GET ALL THE EVALUATIONS (ADMIN ONLY)
@evaluation_bp.route('/all', methods=['GET'])
@require_roles('admin')
def all_evaluations():
    """
    Get all the evaluations (admin only).

    Returns:
        tuple: (response, status) with list of evaluations or forbidden error.
    """
    evaluations = db.session.execute(select(Evaluation)).unique().scalars().all()
    exports = [
        evaluation.export('id', 'booking_id', 'student_id', 'examiner_id', 'total_marks', 'remarks', 'evaluation_date', 'status')
        for evaluation in evaluations
    ]
    return jsonify({'evaluations': exports}), 200

# GET THE EVALUATIONS OF A SPECIFIC EXAMINATION (ADMIN AND ASSIGNED EXAMINER)
@evaluation_bp.route('/examination/<int:examination_id>', methods=['GET'])
@require_roles('admin', 'examiner')
@require_assigned_examiner('examination_id')
def examinations_evaluations(examination_id):
    """
    Get all evaluations for a specific examination by ID (admin and assigned examiner).

    Args:
        examination_id (int): ID of the examination.

    Returns:
        tuple: (response, status) with list of evaluations or error response.
    """
    examination = db.session.get(Examination, examination_id)

    if not examination:
        return jsonify({'error': 'Examination not found'}), 404

    evaluations = db.session.execute(
        select(Evaluation)
        .join(Booking, Evaluation.booking_id == Booking.id)
        .where(Booking.examination_id == examination_id)
    ).unique().scalars().all()

    exports = [
        evaluation.export('id', 'booking_id', 'student_id', 'examiner_id', 'total_marks', 'remarks', 'evaluation_date', 'status')
        for evaluation in evaluations
    ]
    return jsonify({'evaluations': exports}), 200
