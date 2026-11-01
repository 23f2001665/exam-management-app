"""
This blueprint handles all the routes related to examination rubrics, including creating, updating, deleting, and retrieving examination rubric information. 
It does not include evaluation submission functionalities, which are handled in the evaluations.py blueprint.
"""

from flask import Blueprint, request, jsonify, session, g
from ..extensions import db, cache
from ..models import *
from .helpers import require_roles, require_assigned_examiner
from sqlalchemy import select

rubric_bp = Blueprint('rubric', __name__)

# CREATE A NEW EXAMINATION RUBRIC (ADMIN ONLY)
@rubric_bp.route('/create', methods=['POST'])
@require_roles('admin')
def create_rubric():
    """
    Create a new examination rubric (admin only).

    Args:
        None: Expects JSON body with examination_id, criterion_name and max_marks.

    Returns:
        tuple: (response, status) with success message and rubric info, or error response.
    """
    data = g.data
    if {'examination_id', 'criterion_name', 'max_marks'}.issubset(set(data.keys())) is False:
        return jsonify({'error': 'Missing required fields'}), 400

    examination_id = data.get('examination_id')
    examination_id_str = str(examination_id) if examination_id is not None else ''
    if not examination_id_str or not examination_id_str.isdigit() or int(examination_id_str) <= 0:
        return jsonify({'error': 'Invalid examination ID'}), 400

    examination = db.session.get(Examination, int(examination_id_str))
    if not examination:
        return jsonify({'error': 'Examination not found'}), 404

    criterion_name = data.get('criterion_name')
    if not criterion_name:
        return jsonify({'error': 'Criterion name is required'}), 400

    max_marks = data.get('max_marks')
    try:
        max_marks_value = float(max_marks) if max_marks is not None else 1.0
    except (ValueError, TypeError):
        return jsonify({'error': 'Invalid maximum marks value'}), 400
    if max_marks_value <= 0:
        return jsonify({'error': 'Maximum marks must be greater than 0'}), 400

    weightage = float(data.get('weightage') or 0)
    description = data.get('description')

    rubric = ExaminationRubric(
        examination_id=int(examination_id_str),
        criterion_name=criterion_name,
        max_marks=max_marks_value,
        weightage=weightage,
        description=description,
    )
    db.session.add(rubric)

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(e)
        return jsonify({'error': 'An error occurred while creating the examination rubric'}), 500

    return jsonify({'message': 'Examination rubric created successfully', 'rubric_info': rubric.export()}), 201

# GET ALL THE EXAMINATION RUBRICS FOR A SPECIFIC EXAMINATION (ADMIN AND ASSIGNED EXAMINER)
@rubric_bp.route('/examination/<int:examination_id>', methods=['GET'])
@require_roles('admin', 'examiner')
@require_assigned_examiner('examination_id')
@cache.cached(timeout=300, key_prefix=lambda: f'examination_rubrics_{request.view_args["examination_id"]}')
def get_rubrics_for_examination(examination_id):
    """
    Get all rubrics for a specific examination by ID (admin and assigned examiner).

    Args:
        examination_id (int): ID of the examination.

    Returns:
        tuple: (response, status) with list of rubrics or error response.
    """
    examination = db.session.get(Examination, examination_id)

    if not examination:
        return jsonify({'error': 'Examination not found'}), 404

    rubrics = db.session.execute(
        select(ExaminationRubric).where(ExaminationRubric.examination_id == examination_id)
    ).scalars().all()
    exports = [
        rubric.export('id', 'examination_id', 'criterion_name', 'max_marks', 'weightage', 'description')
        for rubric in rubrics
    ]
    return jsonify({'rubrics': exports}), 200

# GET A SPECIFIC EXAMINATION RUBRIC (ADMIN AND ASSIGNED EXAMINER)
@rubric_bp.route('/<int:rubric_id>', methods=['GET'])
@require_roles('admin', 'examiner')
def get_rubric(rubric_id):
    """
    Get a specific examination rubric by ID (admin and assigned examiner).

    Args:
        rubric_id (int): ID of the rubric to fetch.

    Returns:
        tuple: (response, status) with rubric info or not found error.
    """
    rubric = db.session.get(ExaminationRubric, rubric_id)

    if not rubric:
        return jsonify({'error': 'Examination rubric not found'}), 404

    return jsonify({'rubric_info': rubric.export()}), 200

# UPDATE A SPECIFIC EXAMINATION RUBRIC (ADMIN ONLY)
@rubric_bp.route('/<int:rubric_id>', methods=['PATCH'])
@require_roles('admin')
def update_rubric(rubric_id):
    """
    Update a specific examination rubric by ID (admin only).

    Args:
        rubric_id (int): ID of the rubric to update.

    Returns:
        tuple: (response, status) with success message or error response.
    """
    rubric = db.session.get(ExaminationRubric, rubric_id)

    if not rubric:
        return jsonify({'error': 'Examination rubric not found'}), 404

    data = g.data
    criterion_name = data.get('criterion_name')
    if criterion_name:
        rubric.criterion_name = criterion_name

    max_marks = data.get('max_marks')
    if max_marks:
        max_marks_value = float(max_marks)
        if max_marks_value <= 0:
            return jsonify({'error': 'Maximum marks must be greater than 0'}), 400
        rubric.max_marks = max_marks_value

    weightage = data.get('weightage')
    if weightage is not None:
        rubric.weightage = float(weightage)

    description = data.get('description')
    if description is not None:
        rubric.description = description

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(e)
        return jsonify({'error': 'An error occurred while updating the examination rubric'}), 500
    
    cache.delete(f'examination_rubrics_{rubric.examination_id}')  # Invalidate the cache for the rubrics of this examination
    return jsonify({'message': 'Examination rubric updated successfully'}), 200

# DELETE A SPECIFIC EXAMINATION RUBRIC (ADMIN ONLY)
@rubric_bp.route('/<int:rubric_id>', methods=['DELETE'])
@require_roles('admin')
def delete_rubric(rubric_id):
    """
    Delete a specific examination rubric by ID (admin only).

    Args:
        rubric_id (int): ID of the rubric to delete.

    Returns:
        tuple: (response, status) with success message or error response.
    """
    rubric = db.session.get(ExaminationRubric, rubric_id)

    if not rubric:
        return jsonify({'error': 'Examination rubric not found'}), 404

    db.session.delete(rubric)

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(e)
        return jsonify({'error': 'An error occurred while deleting the examination rubric'}), 500
    
    cache.delete(f'examination_rubrics_{rubric.examination_id}')  # Invalidate the cache for the rubrics of this examination
    return jsonify({'message': 'Examination rubric deleted successfully'}), 200
