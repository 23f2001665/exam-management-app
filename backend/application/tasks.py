"""
Celery tasks for the Examination Management Portal backend.

Includes the async report export task, the daily examination reminder email
task and the monthly examination report email task.
"""

from .extensions import celery, db, mail, Message
from .export import export_data, get_daily_mail_data, get_monthly_report_data
from .models import User, UserRoleName
from flask import render_template, current_app as app
from sqlalchemy import select

@celery.task(name="send_report", bind=True, max_retries=3, default_retry_delay=3)
def send_report(self, user_id):
    """
    A Celery task to send a report to a user.

    Generates the examination history report for the given user and returns
    the CSV content. Retries on failure.

    Args:
        self (celery.Task): Task instance (bound task).
        user_id (int): ID of the user for whom the report is generated.

    Returns:
        str: CSV formatted report content.

    Raises:
        Exception: When report generation fails, the task retries.
    """
    try:
        export_result = export_data(app, user_id)
        return export_result
    except Exception as e:
        print(f"Error generating report: {e}")
        raise self.retry(exc=e, countdown=3)

@celery.task(name="send_daily_email", bind=True)     
def send_daily_email(self):
    """
    Send a daily email to the students with their upcoming examinations for the next day.

    Iterates over all students, collects their upcoming examinations for the
    next day and sends a reminder email. Continues when a student has no
    upcoming examinations.

    Args:
        self (celery.Task): Task instance (bound task).

    Returns:
        None: Sends daily reminder emails.
    """
    for user_id in db.session.scalars(select(User.id).where(User.role == UserRoleName.STUDENT)).all():
        rows = get_daily_mail_data(user_id)
        if not rows:
            print(f"No upcoming examinations for user_id: {user_id}")
            continue  # No upcoming examinations for tomorrow

        # Fetch user email
        user = db.session.get(User, user_id)
        if not user:
            print(f"User with id {user_id} not found.")
            continue # User not found

        # Send email using Celery task
        msg = Message(
            subject="Upcoming Examinations and Bookings for Tomorrow",
            sender=app.config['MAIL_DEFAULT_SENDER'],
            recipients=[user.email],
            html=render_template('daily_email.html', user=user, examinations=rows)
        )
        try:
            mail.send(msg)
        except Exception as e:
            print(f"Error sending email to user {user_id}: {e}")
    print("Mail sending task completed.")

# send montly report to admin via email
@celery.task(name="send_monthly_email", bind=True)
def send_monthly_email(self):
    """
    Send a monthly email to the admin with all the examination activity for the month.

    Generates the monthly examination report and sends it to the admin via email.

    Args:
        self (celery.Task): Task instance (bound task).

    Returns:
        None: Sends the monthly report email to the admin.
    """
    # Fetch admin email
    admin_user = db.session.scalars(select(User).where(User.role == UserRoleName.ADMIN)).first()
    if not admin_user:
        print("Admin user not found.")
        return  # Admin user not found

    # Generate monthly report data
    report_data, year_month = get_monthly_report_data()

    # Send email using Celery task
    msg = Message(
        subject="Monthly Examination Report",
        sender=app.config['MAIL_DEFAULT_SENDER'],
        recipients=[admin_user.email],
        html=render_template('monthly_email.html', **report_data, year_month=year_month)
    )
    try:
        mail.send(msg)
    except Exception as e:
        print(f"Error sending monthly report email to admin: {e}")
