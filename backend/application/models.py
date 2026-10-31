"""
SQLAlchemy models for the Examination Management Portal backend.

Defines the unified user model and the examination domain entities:
Course, Examination, ExaminationRubric, ExaminationSlot, Booking and
Evaluation, along with their enums and export mixins.
"""

from __future__ import annotations

from enum import StrEnum, Enum
from datetime import date, datetime, time
from decimal import Decimal

from .extensions import db, hash_password, verify_password


class UserRoleName(StrEnum):
    """
    Enumeration of the user roles in the Examination Management Portal.
    """
    ADMIN = "admin"
    EXAMINER = "examiner"
    STUDENT = "student"


class CourseStatus(StrEnum):
    """
    Enumeration of the status of a course.
    """
    ACTIVE = "active"
    INACTIVE = "inactive"


class ExaminationStatus(StrEnum):
    """
    Enumeration of the lifecycle status of an examination.
    """
    DRAFT = "draft"
    SLOT_CREATION = "slot_creation"
    BOOKING_OPEN = "booking_open"
    CLOSED = "closed"
    COMPLETED = "completed"


class ExaminationType(StrEnum):
    """
    Enumeration of the type of an examination.
    """
    VIVA = "viva"
    PRACTICAL = "practical"
    PROJECT_DEMO = "project_demo"
    ASSESSMENT = "assessment"


class SlotStatus(StrEnum):
    """
    Enumeration of the status of an examination slot.
    """
    AVAILABLE = "available"
    FULL = "full"
    CANCELLED = "cancelled"
    COMPLETED = "completed"


class BookingStatus(StrEnum):
    """
    Enumeration of the status of a booking.
    """
    BOOKED = "booked"
    CANCELLED = "cancelled"
    COMPLETED = "completed"


class EvaluationStatus(StrEnum):
    """
    Enumeration of the status of an evaluation.
    """
    PENDING = "pending"
    SUBMITTED = "submitted"


class ExportMixin:
    """
    Mixin for exporting SQLAlchemy models to JSON-friendly dictionaries.

    Supports exporting selected fields or all mapped columns plus extra
    computed properties.
    """

    # Override in subclasses if desired.
    # Example:
    # extra_properties = ("seats_available", "is_full")
    extra_properties: tuple[str, ...] = ()

    @property
    def _columns(self) -> tuple[str, ...]:
        """
        Names of all mapped database columns.

        Returns:
            tuple[str, ...]: Column names of the mapped table.
        """
        return tuple(column.name for column in self.__table__.columns)

    @staticmethod
    def _serialize(value):
        """
        Convert common Python/SQLAlchemy types into JSON-friendly values.

        Args:
            value: Value to convert.

        Returns:
            object: JSON-friendly representation (enum -> value, date/datetime/time -> isoformat, Decimal -> float, else value).
        """

        if isinstance(value, Enum):
            return value.value

        if isinstance(value, (datetime, date, time)):
            return value.isoformat()

        if isinstance(value, Decimal):
            return float(value)

        return value

    def export(self, *fields: str) -> dict[str, object]:
        """
        Export selected fields.

        If no fields are supplied, export all mapped columns and all extra
        properties listed in `extra_properties`.

        Args:
            *fields (str): Names of the fields to export.

        Returns:
            dict[str, object]: Exported field-value mapping.

        Raises:
            ValueError: If any requested field is unknown.
        """
        if not fields:
            data = {
                field: self._serialize(getattr(self, field))
                for field in self._columns
            }

            for prop in self.extra_properties:
                data[prop] = self._serialize(getattr(self, prop))

            return data

        allowed = set(self._columns) | set(self.extra_properties)

        invalid = set(fields) - allowed
        if invalid:
            raise ValueError(f"Unknown export fields: {sorted(invalid)}")

        return {
            field: self._serialize(getattr(self, field))
            for field in fields
        }

    def exclude(self, *fields: str) -> dict[str, object]:
        """
        Export every mapped column and extra property except the excluded ones.

        Args:
            *fields (str): Names of the fields to exclude.

        Returns:
            dict[str, object]: Exported field-value mapping excluding the given fields.

        Raises:
            ValueError: If any excluded field is unknown.
        """

        allowed = tuple(self._columns) + tuple(self.extra_properties)

        invalid = set(fields) - set(allowed)
        if invalid:
            raise ValueError(f"Unknown excluded fields: {sorted(invalid)}")

        excluded = set(fields)

        return {
            field: self._serialize(getattr(self, field))
            for field in allowed
            if field not in excluded
        }

def enum_values(enum_cls: type[StrEnum]) -> list[str]:
    """
    Return the list of string values for the given enum class.

    Args:
        enum_cls (type[StrEnum]): Enum class whose member values are collected.

    Returns:
        list[str]: List of enum member values.
    """
    return [member.value for member in enum_cls]


class TimestampMixin:
    """
    Mixin adding created-at and updated-at timestamp columns to a model.
    """

    created_at = db.Column(db.DateTime, nullable=False, server_default=db.func.now())
    updated_at = db.Column(
        db.DateTime,
        nullable=False,
        server_default=db.func.now(),
        onupdate=db.func.now(),
    )


class User(db.Model, TimestampMixin, ExportMixin):
    """
    Unified user model for the Examination Management Portal.

    Differentiates the three platform roles (admin, examiner and student) and
    holds the credential/profile information of the user.
    """
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False, default="dummy_password_hash", server_default="dummy_password_hash")
    first_name = db.Column(db.String(80), nullable=False)
    last_name = db.Column(db.String(80), nullable=True)
    is_active = db.Column(db.Boolean, nullable=False, default=True, server_default=db.true())
    role = db.Column(
        db.Enum(
            UserRoleName,
            native_enum=False,
            create_constraint=True,
            validate_strings=True,
            values_callable=enum_values,
        ),
        nullable=False,
        default=UserRoleName.STUDENT,
        server_default=UserRoleName.STUDENT.value,
    )
    department = db.Column(db.String(120), nullable=True)

    bookings = db.relationship(
        "Booking",
        back_populates="student",
        cascade="all, delete-orphan",
        foreign_keys="Booking.student_id",
        lazy="selectin",
    )

    examinations = db.relationship(
        "Examination",
        back_populates="examiner",
        cascade="all, delete-orphan",
        foreign_keys="Examination.examiner_id",
        lazy="selectin",
    )

    __table_args__ = (
        db.CheckConstraint(
            "email LIKE '%@%.%'",
            name="ck_users_email_shape",
        ),
        db.Index("ix_users_email", "email", "is_active"),
        db.Index("ix_users_role", "role", "is_active"),
        db.Index("ix_users_first_last_name", "first_name", "last_name"),
        db.Index("ix_users_is_active", "is_active"),
    )

    @property
    def is_admin(self) -> bool:
        """
        Whether the user is an admin.

        Returns:
            bool: True if the user role is admin.
        """
        return self.role == UserRoleName.ADMIN
    
    @property
    def is_examiner(self) -> bool:
        """
        Whether the user is an examiner.

        Returns:
            bool: True if the user role is examiner.
        """
        return self.role == UserRoleName.EXAMINER
    
    @property
    def is_student(self) -> bool:
        """
        Whether the user is a student.

        Returns:
            bool: True if the user role is student.
        """
        return self.role == UserRoleName.STUDENT

    @property
    def full_name(self) -> str:
        """
        Full display name of the user.

        Returns:
            str: First name plus last name when present, otherwise first name.
        """
        if self.last_name:
            return f"{self.first_name} {self.last_name}"
        return self.first_name

    def set_password(self, password: str) -> None:
        """
        Set the password hash for the user.

        Args:
            password (str): Plain-text password to hash.

        Returns:
            None: Sets the internal password hash.

        Raises:
            ValueError: If the password is empty.
        """
        if not password:
            raise ValueError("Password cannot be empty")
        self.password_hash = hash_password(password)

    def check_password(self, password: str) -> bool:
        """
        Verify the given plain-text password against the stored hash.

        Args:
            password (str): Plain-text password to verify.

        Returns:
            bool: True when the password matches, False otherwise.
        """
        if not self.password_hash:
            return False
        return verify_password(password, self.password_hash)

    def make_examiner(self, department: str | None = None) -> None:
        """
        Promote the user to the examiner role and optionally set the department.

        Args:
            department (str | None): Department name of the examiner. Defaults to None.
        """
        self.role = UserRoleName.EXAMINER
        self.department = department

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email!r}>"

    extra_properties = ("full_name", "is_admin", "is_examiner", "is_student")


class Course(db.Model, TimestampMixin, ExportMixin):
    """
    Model representing a course under which examinations are conducted.
    """
    __tablename__ = "courses"

    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(32), unique=True, nullable=False)
    name = db.Column(db.String(160), nullable=False)
    description = db.Column(db.Text, nullable=True)
    status = db.Column(
        db.Enum(
            CourseStatus,
            native_enum=False,
            create_constraint=True,
            validate_strings=True,
            values_callable=enum_values,
        ),
        nullable=False,
        default=CourseStatus.ACTIVE,
        server_default=CourseStatus.ACTIVE.value,
    )

    examinations = db.relationship(
        "Examination",
        back_populates="course",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    __table_args__ = (
        db.CheckConstraint(
            "status IN ('active', 'inactive')",
            name="ck_courses_status",
        ),
        db.Index("ix_courses_status", "status"),
    )

    @property
    def is_active(self) -> bool:
        """
        Whether the course is active.

        Returns:
            bool: True if the course status is active.
        """
        return self.status == CourseStatus.ACTIVE

    def activate(self) -> None:
        """
        Activate the course.

        Returns:
            None: Sets the course status to active.
        """
        self.status = CourseStatus.ACTIVE

    def deactivate(self) -> None:
        """
        Deactivate the course.

        Returns:
            None: Sets the course status to inactive.
        """
        self.status = CourseStatus.INACTIVE

    def __repr__(self) -> str:
        return f"<Course id={self.id} code={self.code!r} name={self.name!r}>"

    extra_properties = ("is_active",)


class Examination(db.Model, TimestampMixin, ExportMixin):
    """
    Model representing an examination conducted for a course.

    Tracks the examination type, duration, maximum marks, slot creation and
    booking timelines, lifecycle status and the assigned examiner.
    """
    __tablename__ = "examinations"

    id = db.Column(db.Integer, primary_key=True)
    course_id = db.Column(db.Integer, db.ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    name = db.Column(db.String(255), nullable=False)
    type = db.Column(
        db.Enum(
            ExaminationType,
            native_enum=False,
            create_constraint=True,
            validate_strings=True,
            values_callable=enum_values,
        ),
        nullable=False,
        default=ExaminationType.ASSESSMENT,
        server_default=ExaminationType.ASSESSMENT.value,
    )
    duration = db.Column(db.Integer, nullable=False, default=60, server_default="60")
    max_marks = db.Column(db.Numeric(10, 2), nullable=False, default=100, server_default="100")
    slot_creation_start = db.Column(db.DateTime, nullable=False)
    slot_creation_end = db.Column(db.DateTime, nullable=False)
    slot_booking_start = db.Column(db.DateTime, nullable=False)
    slot_booking_end = db.Column(db.DateTime, nullable=False)
    status = db.Column(
        db.Enum(
            ExaminationStatus,
            native_enum=False,
            create_constraint=True,
            validate_strings=True,
            values_callable=enum_values,
        ),
        nullable=False,
        default=ExaminationStatus.DRAFT,
        server_default=ExaminationStatus.DRAFT.value,
    )
    examiner_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"))
    results_published = db.Column(db.Boolean, nullable=False, default=False, server_default="0")

    course = db.relationship("Course", back_populates="examinations")
    examiner = db.relationship("User", back_populates="examinations", foreign_keys="Examination.examiner_id", lazy="joined")
    rubrics = db.relationship("ExaminationRubric", back_populates="examination", cascade="all, delete-orphan", lazy="selectin")
    slots = db.relationship("ExaminationSlot", back_populates="examination", cascade="all, delete-orphan", lazy="selectin")
    bookings = db.relationship("Booking", back_populates="examination", cascade="all, delete-orphan", lazy="selectin")

    __table_args__ = (
        db.CheckConstraint("duration > 0", name="ck_examinations_duration_positive"),
        db.CheckConstraint("max_marks > 0", name="ck_examinations_max_marks_positive"),
        db.CheckConstraint("slot_booking_start >= slot_creation_end", name="ck_examinations_timeline"),
        db.Index("ix_examinations_course_status", "course_id", "status"),
        db.Index("ix_examinations_status", "status"),
    )

    @property
    def is_draft(self) -> bool:
        """
        Whether the examination is in draft status.

        Returns:
            bool: True if the status is draft.
        """
        return self.status == ExaminationStatus.DRAFT

    @property
    def is_slot_creation(self) -> bool:
        """
        Whether the examination is open for slot creation.

        Returns:
            bool: True if the status is slot_creation.
        """
        return self.status == ExaminationStatus.SLOT_CREATION

    @property
    def is_booking_open(self) -> bool:
        """
        Whether student slot booking is open for the examination.

        Returns:
            bool: True if the status is booking_open.
        """
        return self.status == ExaminationStatus.BOOKING_OPEN

    @property
    def is_closed(self) -> bool:
        """
        Whether the examination booking is closed.

        Returns:
            bool: True if the status is closed.
        """
        return self.status == ExaminationStatus.CLOSED

    @property
    def is_completed(self) -> bool:
        """
        Whether the examination is completed.

        Returns:
            bool: True if the status is completed.
        """
        return self.status == ExaminationStatus.COMPLETED

    def open_slot_creation(self) -> None:
        """
        Move the examination into the slot creation status.
        """
        self.status = ExaminationStatus.SLOT_CREATION

    def open_booking(self) -> None:
        """
        Open the slot booking for the examination.
        """
        self.status = ExaminationStatus.BOOKING_OPEN

    def close(self) -> None:
        """
        Close the slot booking for the examination.
        """
        self.status = ExaminationStatus.CLOSED

    def complete(self) -> None:
        """
        Mark the examination as completed.
        """
        self.status = ExaminationStatus.COMPLETED

    def __repr__(self) -> str:
        return f"<Examination id={self.id} name={self.name!r} status={self.status}>"

    extra_properties = ("is_draft", "is_slot_creation", "is_booking_open", "is_closed", "is_completed", "results_published")


class ExaminationRubric(db.Model, TimestampMixin, ExportMixin):
    """
    Model representing an evaluation rubric criterion for an examination.

    Each rubric ties a criterion name, maximum marks, weightage and optional
    description to a specific examination.
    """
    __tablename__ = "examination_rubrics"

    id = db.Column(db.Integer, primary_key=True)
    examination_id = db.Column(db.Integer, db.ForeignKey("examinations.id", ondelete="CASCADE"), nullable=False)
    criterion_name = db.Column(db.String(160), nullable=False)
    max_marks = db.Column(db.Numeric(10, 2), nullable=False, default=1, server_default="1")
    weightage = db.Column(db.Numeric(10, 2), nullable=False, default=0, server_default="0")
    description = db.Column(db.Text, nullable=True)

    examination = db.relationship("Examination", back_populates="rubrics", lazy="selectin")

    def __repr__(self) -> str:
        return f"<ExaminationRubric id={self.id} examination_id={self.examination_id} criterion_name={self.criterion_name!r}>"

    extra_properties = ()


class ExaminationSlot(db.Model, TimestampMixin, ExportMixin):
    """
    Model representing an examination slot (time slot) created by an examiner.

    Tracks date/time window, capacity, available seats and status of the slot.
    """
    __tablename__ = "examination_slots"

    id = db.Column(db.Integer, primary_key=True)
    examination_id = db.Column(db.Integer, db.ForeignKey("examinations.id", ondelete="CASCADE"), nullable=False)
    examiner_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=False)
    date = db.Column(db.Date, nullable=False)
    start_time = db.Column(db.Time, nullable=False)
    end_time = db.Column(db.Time, nullable=False)
    max_capacity = db.Column(db.Integer, nullable=False, default=1, server_default="1")
    available_seats = db.Column(db.Integer, nullable=False, default=1, server_default="1")
    status = db.Column(
        db.Enum(
            SlotStatus,
            native_enum=False,
            create_constraint=True,
            validate_strings=True,
            values_callable=enum_values,
        ),
        nullable=False,
        default=SlotStatus.AVAILABLE,
        server_default=SlotStatus.AVAILABLE.value,
    )
    meeting_link = db.Column(db.String(512), nullable=True)

    examination = db.relationship("Examination", back_populates="slots", lazy="selectin")
    examiner = db.relationship("User", foreign_keys="ExaminationSlot.examiner_id", lazy="joined")
    bookings = db.relationship("Booking", back_populates="slot", cascade="all, delete-orphan", lazy="selectin")

    __table_args__ = (
        db.CheckConstraint("max_capacity > 0", name="ck_slots_capacity_positive"),
        db.CheckConstraint("available_seats >= 0", name="ck_slots_available_nonnegative"),
        db.CheckConstraint("end_time > start_time", name="ck_slots_time_window"),
        db.CheckConstraint("status IN ('available', 'full', 'cancelled', 'completed')", name="ck_slots_status"),
        db.Index("ix_slots_examination_status", "examination_id", "status"),
        db.Index("ix_slots_date_status", "date", "status"),
    )

    @property
    def is_available(self) -> bool:
        """
        Whether the slot is available for booking.

        Returns:
            bool: True if the slot status is available.
        """
        return self.status == SlotStatus.AVAILABLE

    @property
    def is_full(self) -> bool:
        """
        Whether the slot is full (no seats available).

        Returns:
            bool: True if the slot status is full or available seats <= 0.
        """
        return self.status == SlotStatus.FULL or self.available_seats <= 0

    @property
    def is_cancelled(self) -> bool:
        """
        Whether the slot is cancelled.

        Returns:
            bool: True if the slot status is cancelled.
        """
        return self.status == SlotStatus.CANCELLED

    @property
    def is_completed(self) -> bool:
        """
        Whether the slot is completed.

        Returns:
            bool: True if the slot status is completed.
        """
        return self.status == SlotStatus.COMPLETED

    def open(self) -> None:
        """
        Re-open the slot (set status back to available).
        """
        self.status = SlotStatus.AVAILABLE

    def mark_full(self) -> None:
        """
        Mark the slot as full when available seats reach zero.
        """
        if self.available_seats <= 0:
            self.status = SlotStatus.FULL

    def complete(self) -> None:
        """
        Mark the slot as completed.
        """
        self.status = SlotStatus.COMPLETED

    def cancel(self) -> None:
        """
        Cancel the slot.
        """
        self.status = SlotStatus.CANCELLED

    def __repr__(self) -> str:
        return f"<ExaminationSlot id={self.id} examination_id={self.examination_id} date={self.date} status={self.status}>"

    extra_properties = ("is_available", "is_full", "is_cancelled", "is_completed")


class Booking(db.Model, TimestampMixin, ExportMixin):
    """
    Model representing a student booking an examination slot.

    A student can book only one slot per examination (enforced by a unique
    constraint) and bookings are managed through the booking lifecycle.
    """
    __tablename__ = "bookings"

    id = db.Column(db.Integer, primary_key=True)
    examination_id = db.Column(db.Integer, db.ForeignKey("examinations.id", ondelete="CASCADE"), nullable=False)
    slot_id = db.Column(db.Integer, db.ForeignKey("examination_slots.id", ondelete="CASCADE"), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    booking_date = db.Column(db.DateTime, nullable=False, server_default=db.func.now())
    status = db.Column(
        db.Enum(
            BookingStatus,
            native_enum=False,
            create_constraint=True,
            validate_strings=True,
            values_callable=enum_values,
        ),
        nullable=False,
        default=BookingStatus.BOOKED,
        server_default=BookingStatus.BOOKED.value,
    )

    examination = db.relationship("Examination", back_populates="bookings", lazy="joined")
    slot = db.relationship("ExaminationSlot", back_populates="bookings", lazy="joined")
    student = db.relationship("User", back_populates="bookings", foreign_keys="Booking.student_id", lazy="joined")
    evaluation = db.relationship("Evaluation", back_populates="booking", cascade="all, delete-orphan", lazy="joined")

    __table_args__ = (
        db.UniqueConstraint("examination_id", "student_id", name="uq_booking_per_student_per_exam"),
        db.Index("ix_bookings_slot_id", "slot_id"),
        db.Index("ix_bookings_student_id", "student_id"),
        db.Index("ix_bookings_status_booking_date", "status", "booking_date"),
    )

    @property
    def is_booked(self) -> bool:
        """
        Whether the booking is in booked status.

        Returns:
            bool: True if the booking status is booked.
        """
        return self.status == BookingStatus.BOOKED

    def cancel(self) -> None:
        """
        Cancel the booking.

        Returns:
            None: Sets the booking status to cancelled.
        """
        self.status = BookingStatus.CANCELLED

    def complete(self) -> None:
        """
        Mark the booking as completed.

        Returns:
            None: Sets the booking status to completed.
        """
        self.status = BookingStatus.COMPLETED

    def __repr__(self) -> str:
        return f"<Booking id={self.id} examination_id={self.examination_id} slot_id={self.slot_id} student_id={self.student_id} status={self.status}>"

    extra_properties = ("is_booked",)


class Evaluation(db.Model, TimestampMixin, ExportMixin):
    """
    Model representing an examination evaluation submitted by an examiner
    for a booked student.
    """
    __tablename__ = "evaluations"

    id = db.Column(db.Integer, primary_key=True)
    booking_id = db.Column(db.Integer, db.ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    examiner_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=False)
    total_marks = db.Column(db.Numeric(10, 2), nullable=True)
    remarks = db.Column(db.Text, nullable=True)
    evaluation_date = db.Column(db.DateTime, nullable=True, server_default=db.func.now())
    status = db.Column(
        db.Enum(
            EvaluationStatus,
            native_enum=False,
            create_constraint=True,
            validate_strings=True,
            values_callable=enum_values,
        ),
        nullable=False,
        default=EvaluationStatus.PENDING,
        server_default=EvaluationStatus.PENDING.value,
    )

    booking = db.relationship("Booking", back_populates="evaluation", lazy="joined")
    """Relationship to the booking that was evaluated."""

    student = db.relationship("User", foreign_keys="Evaluation.student_id", lazy="joined")
    """Relationship to the evaluated student."""

    examiner = db.relationship("User", foreign_keys="Evaluation.examiner_id", lazy="joined")
    """Relationship to the examiner who submitted the evaluation."""

    def __repr__(self) -> str:
        """
        Return a string representation of the evaluation.
        """
        return f"<Evaluation id={self.id} booking_id={self.booking_id} student_id={self.student_id} examiner_id={self.examiner_id} status={self.status}>"

    extra_properties = ()


__all__ = [
    "Booking",
    "BookingStatus",
    "Course",
    "CourseStatus",
    "Evaluation",
    "EvaluationStatus",
    "Examination",
    "ExaminationRubric",
    "ExaminationStatus",
    "ExaminationType",
    "ExaminationSlot",
    "SlotStatus",
    "TimestampMixin",
    "User",
    "UserRoleName",
    "enum_values",
]
