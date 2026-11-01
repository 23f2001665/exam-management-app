# exam-management-app

A web application for managing examinations. **Examination Management Portal (EMP)** web application that allows Admin, Examiners, and Students to interact with the system based on their roles.

## Overview

The **Examination Management Portal (EMP)** is a web application that allows Admins, Examiners and
Students to interact with the examination management system based on their roles.

Based on the project problem statement, the portal supports:

- **Admin**: creates courses, examinations (with slot creation/booking windows, duration, max marks,
  examiner assignment) and rubrics; manages users/examiners (create examiner, activate/deactivate);
  publishes exam results; views reports/dashboard.
- **Examiner**: creates/manages examination slots (date, time, capacity, meeting link); books
  evaluations for booked students.
- **Student**: registers, browses/exams, books examination slots (capacity + unique booking per
  student per exam enforced by DB constraint), views own bookings.

Examination lifecycle (status state machine):

`draft -> slot_creation -> booking_open -> closed -> completed`

- `draft` → `slot_creation` (examiner creates slots)
- `slot_creation` → `booking_open` (booking window opens)
- `booking_open -> closed` (booking window closes)
- `closed -> completed` (results submitted/completed; results can be published)

Reporting & notifications:

- CSV examination history export (`send_report` Celery task + `/summary/export` endpoints).
- Daily email with tomorrow's examinations (`send_daily_email`).
- Monthly email report with examination activity (`send_monthly_email`).

## Backend

Backend for the **Examination Management Portal (EMP)** web application, built with **Flask**.

It follows the same architecture and conventions as the sample backend of the `trekking-app`:

- Pull the extensions from `extensions.py`.
- Add the configuration in `config.py`.
- Initialize the extension in `__init__.py`.
- Then use the extension in the `routes.py` or `models.py` or wherever needed.
- Finally, the `app` is created in `__init__.py` and then run in `app.py`.

### Modules

- `application/config.py` — configuration (Redis, Celery, Mail, Session, SQLAlchemy, Admin).
- `application/extensions.py` — extension instances (cache, celery, db, mail, ph, session) + initialization helpers.
- `application/models.py` — SQLAlchemy models (User, Course, Examination, ExaminationRubric, ExaminationSlot, Booking, Evaluation) + enums.
- `application/routes/` — Flask blueprints (auth, users, courses, examinations, rubrics, slots, bookings, evaluations, summary).
- `application/tasks.py` — Celery tasks (report export, daily email, monthly email).
- `application/export.py` — CSV export + email report data helpers.
- `application/schedules.py` — Celery beat schedule.
- `application/templates/` — Email templates (daily + monthly).

### Run

The backend uses a `backend` package layout (same as the sample backend of the `trekking-app`), so the stack can be started with module-style commands from the repository root:

```bash
python -m backend.app
```

or with the backend's own uv environment:

```bash
cd backend
uv sync
uv run flask --app backend.app run
```

The Flask API listens on port `5050` by default (`FLASK_RUN_PORT` overrides it).

### Celery

`backend.celery_worker` creates the Flask app and wires the Celery broker/config at import time, so the worker and beat can be pointed at it:

```bash
celery -A backend.celery_worker.celery worker --loglevel=info
celery -A backend.celery_worker.celery beat --loglevel=info
```

### Mail

The backend requires the `MAIL_USERNAME` and `MAIL_PASSWORD` entries (via environment variables or `backend/.env`); it fails at startup when they are missing.

### Seed

```bash
python -m backend.seed
```

## Frontend

The frontend is an **Angular 22** single-page application (standalone components, Angular Material,
SCSS) located under `frontend/`, with services under `frontend/src/app/core/services` and feature
components under `frontend/src/app/features/{admin,examiner,student}`.

### Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify your source files.

### Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

### Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, run:

```bash
ng test
```

## Installation

### Backend

Prerequisites: **Python 3.14**, **uv**, **Redis**.

1. Create/use the Python virtual environment (e.g. `~/Documents/web-venv`) and install backend dependencies:

```bash
cd backend
uv pip install --python /home/himanshu/Documents/web-venv/bin/python -r pyproject.toml
```

2. Make sure `Redis` is running (e.g. `redis-server`).

3. Provide the required mail configuration in the environment / `backend/.env` (at minimum `MAIL_USERNAME` and `MAIL_PASSWORD`; the backend fails at startup if these are missing):

```
MAIL_USERNAME=you@example.com
MAIL_PASSWORD=your-mail-app-password
```

4. (Optional) Admin credentials via `ADMIN_EMAIL`, `ADMIN_PASSWORD`, etc.

### Frontend

Prerequisites: **Node.js 22+**, **npm**, `@angular/material`, etc. (frontend dependencies installed via `npm install` inside `frontend/`).

## Running (full stack)

### Local dev stack (backend + celery + frontend)

```bash
./devstack.sh
```

### Docker (backend + frontend + redis + celery)

```bash
docker compose up --build -d
```

The backend container requires the `MAIL_USERNAME` and `MAIL_PASSWORD` entries in the root `.env`; without them it exits at startup.

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

## Seed

```bash
python -m backend.seed
```
