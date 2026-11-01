"""
API route blueprints for the Examination Management Portal backend.

Aggregates all blueprint modules and exposes their registered blueprints.
"""

from .auth import auth_bp
from .users import user_bp
from .courses import course_bp
from .examinations import exam_bp
from .rubrics import rubric_bp
from .slots import slot_bp
from .bookings import booking_bp
from .evaluations import evaluation_bp
from .summary import summary_bp

__all__ = ['auth_bp', 'user_bp', 'course_bp', 'exam_bp', 'rubric_bp', 'slot_bp', 'booking_bp', 'evaluation_bp', 'summary_bp']
