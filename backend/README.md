# Examination Management Portal Backend

Backend for the **Examination Management Portal (EMP)** web application, built with **Flask**.

It follows the same architecture and conventions as the sample backend of the `trekking-app`:

- Pull the extensions from `extensions.py`.
- Add the configuration in `config.py`.
- Initialize the extension in `__init__.py`.
- Then use the extension in the `routes.py` or `models.py` or wherever needed.
- Finally, the `app` is created in `__init__.py` and then run in `app.py`.

## Modules

- `application/config.py` — configuration (Redis, Celery, Mail, Session, SQLAlchemy, Admin).
- `application/extensions.py` — extension instances (cache, celery, db, mail, ph, session) + initialization helpers.
- `application/models.py` — SQLAlchemy models (User, Course, Examination, ExaminationRubric, ExaminationSlot, Booking, Evaluation) + enums.
- `application/routes/` — Flask blueprints (auth, users, courses, examinations, rubrics, slots, bookings, evaluations, summary).
- `application/tasks.py` — Celery tasks (report export, daily email, monthly email).
- `application/export.py` — CSV export + email report data helpers.
- `application/schedules.py` — Celery beat schedule.
- `application/templates/` — Email templates (daily + monthly).

## Endpoints

- `POST /login`, `POST /logout`, `POST /register`, `GET|PATCH /user_info`
- `GET /users/all`, `GET|PATCH /users/<user_id>`, `POST /users/<user_id>/activate|deactivate`, `POST /users/create_examiner`
- `GET /courses/all`, `POST /courses/create`, `GET|PATCH|DELETE /courses/<course_id>`
- `GET /examinations/all`, `POST /examinations/create`, `GET|PATCH|DELETE /examinations/<examination_id>`, `PATCH /examinations/<examination_id>/status`, `PATCH /examinations/<examination_id>/assign_examiner`, `POST /examinations/<examination_id>/publish_results`
- `POST /rubrics/create`, `GET /rubrics/examination/<examination_id>`, `GET|PATCH|DELETE /rubrics/<rubric_id>`
- `POST /slots/create`, `GET /slots/all`, `GET /slots/examination/<examination_id>`, `GET /slots/examination/<examination_id>/booked_students`, `PATCH|DELETE /slots/<slot_id>`
- `POST /bookings/create`, `GET|PATCH /bookings/<booking_id>`, `POST /bookings/<booking_id>/reschedule`, `GET /bookings/all`, `GET /bookings/examination/<examination_id>`
- `POST /evaluations/create`, `GET /evaluations/pending`, `GET /evaluations/all`, `GET /evaluations/examination/<examination_id>`
- `GET /summary/users`, `GET /summary/examinations`, `GET /summary/bookings`, `GET /summary/dashboard`, `GET /summary/export`, `GET /summary/export/<task_id>`

## Run

```bash
cd backend
uv sync
uv run flask --app app run   # or: python app.py
```

## Celery

```bash
celery -A application.celery worker --loglevel=info
celery -A application.celery beat --loglevel=info
```
