"""
Export and reporting helpers for the Examination Management Portal backend.

Provides CSV conversion, examination history export and report data helpers
used by the Celery tasks and the summary API.
"""

import csv
from io import StringIO
from datetime import date, timedelta
from sqlalchemy import func, select
from .extensions import db
from .models import Booking, BookingStatus, Course, Evaluation, EvaluationStatus, Examination, ExaminationSlot, User

def convert_to_csv(rows, headers):
    """
    Convert a list of row dicts into a CSV string.

    Args:
        rows (list[dict]): Rows to serialize.
        headers (list[str]): Column names (fieldnames) for the CSV header.

    Returns:
        str: CSV formatted string.
    """
    output = StringIO()

    writer = csv.DictWriter(
        output,
        fieldnames=headers,
        extrasaction="ignore"
    )

    writer.writeheader()
    writer.writerows(rows)

    return output.getvalue()


def export_data(app, user_id=None):
    """
    Export the examination history of a user as CSV rows.

    For now, this exports the examination history of the given student,
    including examination details, slot details, examiner and marks obtained.

    Args:
        app (flask.Flask): Flask application instance.
        user_id (int, optional): ID of the user whose history is exported.
            Defaults to None.

    Returns:
        str: CSV formatted string containing the examination history.
    """
    stmt = (
        select(
            Booking.id.label("booking_id"),
            Examination.name.label("examination_name"),
            Course.code.label("course_code"),
            Course.name.label("course_name"),
            ExaminationSlot.date.label("examination_date"),
            ExaminationSlot.start_time.label("slot_start_time"),
            ExaminationSlot.end_time.label("slot_end_time"),
            Examination.examiner_id.label("examiner_id"),
            Evaluation.total_marks.label("total_marks"),
            Booking.status.label("booking_status"),
        )
        .join(Examination, Booking.examination_id == Examination.id)
        .join(Course, Examination.course_id == Course.id)
        .join(ExaminationSlot, Booking.slot_id == ExaminationSlot.id)
        .outerjoin(Evaluation, Evaluation.booking_id == Booking.id)
        .where(Booking.student_id == user_id)
    )

    rows = db.session.execute(stmt).mappings().all()

    export_rows = []
    for row in rows:
        export_rows.append({
            "booking_id": row["booking_id"],
            "examination_name": row["examination_name"],
            "course_code": row["course_code"],
            "course_name": row["course_name"],
            "examination_date": row["examination_date"].isoformat() if row["examination_date"] is not None else None,
            "slot_start_time": row["slot_start_time"].isoformat() if row["slot_start_time"] is not None else None,
            "slot_end_time": row["slot_end_time"].isoformat() if row["slot_end_time"] is not None else None,
            "examiner_id": row["examiner_id"],
            "total_marks": float(row["total_marks"]) if row["total_marks"] is not None else None,
            "booking_status": row["booking_status"].value if row["booking_status"] is not None else None,
        })

    headers = [
        "booking_id",
        "examination_name",
        "course_code",
        "course_name",
        "examination_date",
        "slot_start_time",
        "slot_end_time",
        "examiner_id",
        "total_marks",
        "booking_status",
    ]

    csv_data = convert_to_csv(export_rows, headers)

    return csv_data


# daily email, for the exams booked by the student which are starting tomorrow
def get_daily_mail_data(user_id):
    """
    Fetch the examinations booked by the student which are starting tomorrow.

    Args:
        user_id (int): ID of the student.

    Returns:
        list[dict]: Rows of upcoming examinations for the student.
    """
    tomorrow = date.today() + timedelta(days=1)
    stmt = (
        select(
            Booking.student_id.label("user_id"),
            Examination.name.label("examination_name"),
            Course.name.label("course_name"),
            ExaminationSlot.date.label("examination_date"),
            ExaminationSlot.start_time.label("slot_start_time"),
            Examination.examiner_id.label("examiner_id"),
        )
        .join(Examination, Booking.examination_id == Examination.id)
        .join(Course, Examination.course_id == Course.id)
        .join(ExaminationSlot, Booking.slot_id == ExaminationSlot.id)
        .where(
            Booking.student_id == user_id,
            ExaminationSlot.date == tomorrow,
        )
    )
    rows = db.session.execute(stmt).mappings().all()
    return rows


# Admin receives a monthly email with all the examinations, bookings and evaluations for the month
def get_monthly_report_data():
    """
    Get the data to send a monthly email to the admin with all the examination activity for the month.

    Generate the monthly activity report.

    Returns:
        tuple[dict, str]: Report data dictionary and the year-month string
        (e.g. "January 2024") for which the report was generated.

    Raises:
        Exception: Propagated from database queries when they fail.
    """

    today = date.today()
    first_day_of_current = today.replace(day=1)
    last_day_of_previous = first_day_of_current - timedelta(days=1)
    first_day_of_month = last_day_of_previous.replace(day=1)
    last_day_of_month = last_day_of_previous
    year_month = first_day_of_month.strftime("%B %Y")  # e.g., "January 2024"

    # Number of examinations conducted
    total_examinations_conducted = int(
        db.session.scalar(
            select(func.count(func.distinct(Examination.id)))
            .select_from(Booking)
            .join(Examination, Booking.examination_id == Examination.id)
            .join(ExaminationSlot, Booking.slot_id == ExaminationSlot.id)
            .where(
                ExaminationSlot.date >= first_day_of_month,
                ExaminationSlot.date <= last_day_of_month,
            )
        )
        or 0
    )

    # Number of students evaluated
    total_students_evaluated = int(
        db.session.scalar(
            select(func.count(func.distinct(Evaluation.student_id)))
            .join(Booking, Evaluation.booking_id == Booking.id)
            .join(ExaminationSlot, Booking.slot_id == ExaminationSlot.id)
            .where(
                Evaluation.status == EvaluationStatus.SUBMITTED,
                ExaminationSlot.date >= first_day_of_month,
                ExaminationSlot.date <= last_day_of_month,
            )
        )
        or 0
    )

    # Number of completed bookings
    total_completed_bookings = int(
        db.session.scalar(
            select(func.count())
            .select_from(Booking)
            .join(ExaminationSlot, Booking.slot_id == ExaminationSlot.id)
            .where(
                Booking.status == BookingStatus.COMPLETED,
                ExaminationSlot.date >= first_day_of_month,
                ExaminationSlot.date <= last_day_of_month,
            )
        )
        or 0
    )

    # Pending evaluations
    pending_evaluations = int(
        db.session.scalar(
            select(func.count())
            .select_from(Evaluation)
            .join(Booking, Evaluation.booking_id == Booking.id)
            .join(ExaminationSlot, Booking.slot_id == ExaminationSlot.id)
            .where(
                Evaluation.status == EvaluationStatus.PENDING,
                ExaminationSlot.date >= first_day_of_month,
                ExaminationSlot.date <= last_day_of_month,
            )
        )
        or 0
    )

    # Most active examiners (by number of completed bookings in the month)
    active_examiners = db.session.execute(
        select(
            User.id.label("examiner_id"),
            User.email.label("examiner_email"),
            func.count(Booking.id).label("evaluated_bookings"),
        )
        .join(Booking, Evaluation.booking_id == Booking.id)
        .join(ExaminationSlot, Booking.slot_id == ExaminationSlot.id)
        .join(Examination, Booking.examination_id == Examination.id)
        .where(
            ExaminationSlot.date >= first_day_of_month,
            ExaminationSlot.date <= last_day_of_month,
            Evaluation.status == EvaluationStatus.SUBMITTED,
        )
        .group_by(User.id, User.email)
        .order_by(func.count(Booking.id).desc())
        .limit(5)
    ).mappings().all()

    return {
        "month": year_month,
        "total_examinations_conducted": total_examinations_conducted,
        "total_students_evaluated": total_students_evaluated,
        "total_completed_bookings": total_completed_bookings,
        "pending_evaluations": pending_evaluations,
        "active_examiners": active_examiners,
    }, year_month
