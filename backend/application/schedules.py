"""
Celery beat schedule for the Examination Management Portal backend.

Defines the scheduled tasks (daily examination reminder and monthly examination
report) that run via Celery beat.
"""

from celery.schedules import crontab

beat_schedule = {
    'send_daily_email': {
        'task': 'send_daily_email',
        'schedule': crontab(minute='0', hour='0')  # Run every day at 00:00 (midnight)
    },
    'send_monthly_email': {
        'task': 'send_monthly_email',
        'schedule': crontab(minute='0', hour='0', day_of_month='1')  # Run on the first day of every month at 00:00
    },
}
