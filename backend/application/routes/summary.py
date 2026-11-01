"""
In this blueprint we handle summary management functionalities. It includes endpoints for retrieving summary information for users, examinations, slots, and bookings, dashboard statistics, and async export of examination history.
"""

from flask import Blueprint, jsonify, session, Response
from sqlalchemy import select, func, and_
from .helpers import require_roles, require_assigned_examiner
from ..extensions import db
from ..models import Booking, BookingStatus, Course, Examination, ExaminationSlot, Evaluation, EvaluationStatus, ExaminationStatus, SlotStatus, User, UserRoleName
from ..tasks import send_report


summary_bp = Blueprint('summary', __name__)


# ============================================================================
# USERS ENDPOINTS
# ============================================================================

@summary_bp.route('/users', methods=['GET'])
@require_roles('admin')
def all_users_summary():
    """
    Get summary information for all users (admin only).

    Returns:
        tuple: (response, status) with user summary or forbidden error.
    """
    result = db.session.execute(
        select(
            func.count().label("total"),
            func.count().filter(User.is_active).label("active"),
            func.count().filter(~User.is_active).label("inactive"),
            func.count().filter(
                and_(User.is_active, User.role == UserRoleName.STUDENT)
            ).label("active_students"),
            func.count().filter(
                and_(~User.is_active, User.role == UserRoleName.STUDENT)
            ).label("inactive_students"),
            func.count().filter(
                and_(User.is_active, User.role == UserRoleName.EXAMINER)
            ).label("active_examiners"),
            func.count().filter(
                and_(~User.is_active, User.role == UserRoleName.EXAMINER)
            ).label("inactive_examiners"),
            func.count().filter(User.role == UserRoleName.ADMIN).label("admins"),
        )
    ).one()
    
    return jsonify({
        'user_summary': {
            'total_users': result.total,
            'active_users': result.active,
            'inactive_users': result.inactive,
            'active_students': result.active_students,
            'inactive_students': result.inactive_students,
            'active_examiners': result.active_examiners,
            'inactive_examiners': result.inactive_examiners,
            'admins': result.admins,
        }
    }), 200


# ============================================================================
# EXAMINATION ENDPOINTS
# ============================================================================

@summary_bp.route('/examinations', methods=['GET'])
@require_roles('admin')
def examinations_summary():
    """
    Get summary for all examinations (filtered by status).

    Returns:
        tuple: (response, status) with examinations summary or forbidden error.
    """
    result = db.session.execute(
        select(
            func.count().label("total"),
            func.count().filter(Examination.status == ExaminationStatus.DRAFT).label("draft"),
            func.count().filter(Examination.status == ExaminationStatus.SLOT_CREATION).label("slot_creation"),
            func.count().filter(Examination.status == ExaminationStatus.BOOKING_OPEN).label("booking_open"),
            func.count().filter(Examination.status == ExaminationStatus.CLOSED).label("closed"),
            func.count().filter(Examination.status == ExaminationStatus.COMPLETED).label("completed"),
        )
    ).one()
    total = result.total if result.total is not None else 0
    
    return jsonify({
        'examinations_summary': {
            'total_examinations': total,
            'draft_examinations': result.draft,
            'slot_creation_examinations': result.slot_creation,
            'booking_open_examinations': result.booking_open,
            'closed_examinations': result.closed,
            'completed_examinations': result.completed,
        }
    }), 200


# ============================================================================
# BOOKING ENDPOINTS
# ============================================================================

@summary_bp.route('/bookings', methods=['GET'])
@require_roles('admin', 'examiner', 'student')
def bookings_summary():
    """
    Get booking summary scoped by the logged-in user's role.

    Returns:
        tuple: (response, status) with bookings summary or forbidden error.
    """
    current_user = session.get('user')

    query = select(
        func.count().label('total'),
        func.count().filter(
            Booking.status == BookingStatus.BOOKED
        ).label('booked'),
        func.count().filter(
            Booking.status == BookingStatus.CANCELLED
        ).label('cancelled'),
        func.count().filter(
            Booking.status == BookingStatus.COMPLETED
        ).label('completed'),
    ).select_from(Booking)

    if current_user['role'] == 'examiner':
        query = (
            query.join(ExaminationSlot)
            .where(ExaminationSlot.examiner_id == current_user['id'])
        )
    elif current_user['role'] == 'student':
        query = query.where(
            Booking.student_id == current_user['id']
        )

    result = db.session.execute(query).one()

    return jsonify({
        "bookings_summary": {
            "total_bookings": result.total,
            "booked_bookings": result.booked,
            "cancelled_bookings": result.cancelled,
            "completed_bookings": result.completed,
        }
    }), 200


# ============================================================================
# DASHBOARD ENDPOINTS
# ============================================================================

@summary_bp.route('/dashboard', methods=['GET'])
@require_roles('admin')
def admin_dashboard():
    """
    Get the dashboard statistics for the admin.

    Returns:
        tuple: (response, status) with dashboard statistics or forbidden error.
    """
    courses_total = db.session.scalar(select(func.count()).select_from(Course)) or 0
    examinations_total = db.session.scalar(select(func.count()).select_from(Examination)) or 0
    students_total = db.session.scalar(select(func.count()).select_from(User).where(User.role == UserRoleName.STUDENT)) or 0
    examiners_total = db.session.scalar(select(func.count()).select_from(User).where(User.role == UserRoleName.EXAMINER)) or 0
    slots_total = db.session.scalar(select(func.count()).select_from(ExaminationSlot)) or 0
    bookings_total = db.session.scalar(select(func.count()).select_from(Booking)) or 0

    return jsonify({
        'dashboard': {
            'total_courses': courses_total,
            'total_examinations': examinations_total,
            'total_students': students_total,
            'total_examiners': examiners_total,
            'total_slots': slots_total,
            'total_bookings': bookings_total,
        }
    }), 200


# ============================================================================
# REPORT / EXPORT ENDPOINTS
# ============================================================================

@summary_bp.route('/export', methods=['GET'])
@require_roles('student')
def request_export():
    """
    Request an export of the user's examination history.

    This will trigger a background task to generate the report.

    Returns:
        tuple: (response, status) with task id or forbidden error.
    """
    current_user = session.get('user')
    
    # Trigger the Celery task to generate the report
    task = send_report.delay(current_user['id'])
    
    return jsonify({'message': 'Report generation initiated. You will receive an email once it is ready.', 'task_id': task.id}), 202

@summary_bp.route('/export/<task_id>', methods=['GET'])
@require_roles('student')
def check_export_status(task_id):
    """
    Check the status of the export task.

    Args:
        task_id (str): ID of the Celery task.

    Returns:
        flask.Response: CSV content when the task succeeded, or task status JSON.
    """
    task = send_report.AsyncResult(task_id)
    
    if task.state == 'SUCCESS':
        return Response(task.result, mimetype='text/csv', headers={
                "Content-Disposition": "attachment; filename=examination_history.csv"
            })
    elif task.state == 'PENDING':
        response = {
            'state': task.state,
            'status': 'Pending...'
        }
    elif task.state == 'FAILURE':
        response = {
            'state': task.state,
            'status': str(task.info),  # Exception info
        }
    else:
        response = {
            'state': task.state,
        }
    
    return response, 200
