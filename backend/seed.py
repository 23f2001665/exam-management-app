"""
Database seeding script for the Examination Management Portal backend.

Populates the database with fake examiners, students, courses, examinations,
rubrics, slots, bookings and evaluations for local development and testing.
"""

from __future__ import annotations

import argparse
import os
import random
from datetime import date, datetime, timedelta

from argon2 import PasswordHasher
from faker import Faker
from sqlalchemy import select

from application import create_app, db
from application.models import (
    Booking,
    BookingStatus,
    Course,
    CourseStatus,
    Evaluation,
    EvaluationStatus,
    Examination,
    ExaminationStatus,
    ExaminationType,
    ExaminationRubric,
    ExaminationSlot,
    SlotStatus,
    User,
    UserRoleName,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Seed database with realistic fake data.")
    parser.add_argument("--env", type=str, default=None, help="Path to .env file")
    parser.add_argument("--examiners", type=int, default=5, help="Target total number of examiners")
    parser.add_argument("--students", type=int, default=20, help="Target total number of students")
    parser.add_argument("--courses", type=int, default=5, help="Target total number of courses")
    parser.add_argument("--examinations", type=int, default=10, help="Target total number of examinations")
    parser.add_argument("--rubrics", type=int, default=3, help="Target total number of rubrics")
    parser.add_argument("--slots", type=int, default=10, help="Target total number of examination slots")
    parser.add_argument("--bookings", type=int, default=25, help="Target total number of bookings")
    parser.add_argument("--evaluations", type=int, default=10, help="Target total number of evaluations")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducibility")
    return parser.parse_args()


def main() -> None:
    """
    Seed the database with fake examination management data.

    Creates admin (if missing), examiners, students, courses, examinations,
    rubrics, slots, bookings and evaluations based on the provided CLI args.

    Returns:
        None: Seeds and prints the seeding summary.
    """
    args = parse_args()

    app = create_app()

    with app.app_context():
        faker = Faker()
        faker.seed_instance(args.seed)
        rng = random.Random(args.seed)
        ph = PasswordHasher()

        # Create admin user if it doesn't exist
        admin_user = db.session.scalar(select(User).where(User.role == UserRoleName.ADMIN))
        if not admin_user:
            admin_user = User(
                email=os.getenv("SEED_ADMIN_EMAIL", "admin@exam.local"),
                first_name="System",
                last_name="Admin",
                role=UserRoleName.ADMIN,
            )
            admin_user.set_password(os.getenv("SEED_ADMIN_PASSWORD", "Admin@123"))
            db.session.add(admin_user)
            db.session.commit()

        # Create examiners
        examiners = []
        for i in range(args.examiners):
            examiner = User(
                email=f"examiner.{i}.{faker.unique.uuid4(cast_to=None).hex[:8]}@exam.local",
                first_name=faker.first_name(),
                last_name=faker.last_name(),
                role=UserRoleName.EXAMINER,
                department="Computer Science",
            )
            examiner.set_password(f"Examiner@123")
            db.session.add(examiner)
            db.session.commit()
            examiners.append(examiner)

        # Create students
        students = []
        for i in range(args.students):
            student = User(
                email=f"student.{i}.{faker.unique.uuid4(cast_to=None).hex[:8]}@exam.local",
                first_name=faker.first_name(),
                last_name=faker.last_name(),
                role=UserRoleName.STUDENT,
            )
            student.set_password(f"Student@123")
            db.session.add(student)
            db.session.commit()
            students.append(student)

        # Create courses
        courses = []
        for i in range(args.courses):
            course = Course(
                code=f"COURSE_{i}",
                name=f"Course {i}",
                description=faker.paragraph(nb_sentences=2),
                status=CourseStatus.ACTIVE,
            )
            db.session.add(course)
            db.session.commit()
            courses.append(course)

        # Create examinations
        examinations = []
        for i in range(args.examinations):
            examination = Examination(
                course_id=courses[i % len(courses)].id,
                name=f"Midsem Examination {i}",
                type=ExaminationType.ASSESSMENT,
                duration=90,
                max_marks=100,
                slot_creation_start=datetime.now() - timedelta(days=7),
                slot_creation_end=datetime.now() - timedelta(days=2),
                slot_booking_start=datetime.now() - timedelta(days=1),
                slot_booking_end=datetime.now() + timedelta(days=30),
                status=ExaminationStatus.COMPLETED,
                examiner_id=examiners[i % len(examiners)].id,
                results_published=True,
            )
            db.session.add(examination)
            db.session.commit()
            examinations.append(examination)

        # Create rubrics for the examinations
        rubrics_created = 0
        for examination in examinations:
            for j in range(max(1, args.rubrics // max(1, len(examinations)))):
                rubric = ExaminationRubric(
                    examination_id=examination.id,
                    criterion_name=f"Criterion {j + 1}",
                    max_marks=10,
                    weightage=10,
                    description=f"Faker description for criterion {j + 1}",
                )
                db.session.add(rubric)
                rubrics_created += 1

        # Create examination slots for the examinations
        slots_created = 0
        for examination in examinations:
            for j in range(max(1, args.slots // max(1, len(examinations)))):
                slot_date = date.today() + timedelta(days=rng.randint(7, 60))
                slot = ExaminationSlot(
                    examination_id=examination.id,
                    examiner_id=examination.examiner_id,
                    date=slot_date,
                    start_time=datetime.strptime("09:00", "%H:%M").time(),
                    end_time=datetime.strptime("10:30", "%H:%M").time(),
                    max_capacity=60,
                    available_seats=60,
                    status=SlotStatus.COMPLETED,
                    meeting_link=f"https://meet.google.com/fake-{examination.id}-{j}",
                )
                db.session.add(slot)
                db.session.commit()
                slots_created += 1

        # Create bookings for the slots
        bookings_created = 0
        for examination in examinations:
            for slot in examination.slots:
                for student in students[: rng.randint(1, 5)]:
                    existing_booking = db.session.scalar(
                        select(Booking).where(
                            Booking.examination_id == examination.id,
                            Booking.student_id == student.id,
                        )
                    )
                    if existing_booking:
                        continue
                    booking = Booking(
                        examination_id=examination.id,
                        slot_id=slot.id,
                        student_id=student.id,
                        status=BookingStatus.BOOKED,
                    )
                    db.session.add(booking)
                    db.session.commit()
                    bookings_created += 1

        # Create evaluations for the bookings
        evaluations_created = 0
        for booking in db.session.execute(select(Booking)).unique().scalars().all():
            if evaluations_created >= args.evaluations:
                break
            evaluation = Evaluation(
                booking_id=booking.id,
                student_id=booking.student_id,
                examiner_id=booking.slot.examiner_id,
                total_marks=50,
                remarks="Faker remarks",
                status=EvaluationStatus.SUBMITTED,
            )
            db.session.add(evaluation)
            booking.status = BookingStatus.COMPLETED
            db.session.commit()
            evaluations_created += 1

        db.session.commit()

        print("Seeding complete")
        print(f"  admin_user_id: {admin_user.id}")
        print(f"  examiners_total: {len(examiners)}")
        print(f"  students_total: {len(students)}")
        print(f"  courses_total: {len(courses)}")
        print(f"  examinations_total: {len(examinations)}")
        print(f"  rubrics_created: {rubrics_created}")
        print(f"  slots_created: {slots_created}")
        print(f"  bookings_created: {bookings_created}")
        print(f"  evaluations_created: {evaluations_created}")


if __name__ == "__main__":
    main()
