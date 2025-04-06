from flask import Blueprint, send_from_directory, render_template, current_app, redirect
import os

main_bp = Blueprint('main', __name__)


@main_bp.route('/')
def index():
    """Serve the main application page"""
    return send_from_directory(current_app.template_folder, 'index.html')


@main_bp.route('/index.html')
def index_html():
    """Redirect /index.html to root for consistency"""
    return redirect('/', code=301)


@main_bp.route('/group-parser.html')
def group_parser():
    """Serve the group parser page"""
    return send_from_directory(current_app.template_folder, 'group_parser.html')


@main_bp.route('/<path:filename>')
def static_files(filename):
    if filename.startswith('uploads/'):
        # Strip 'uploads/' prefix and serve from UPLOAD_FOLDER
        file_path = filename[8:]  # Remove 'uploads/' 
        upload_folder = current_app.config['UPLOAD_FOLDER']
        
        try:
            return send_from_directory(upload_folder, file_path)
        except FileNotFoundError:
            # Log the file not found for debugging
            current_app.logger.error(f"Requested file not found: {file_path}")
            abort(404)
    
    return send_from_directory(current_app.static_folder, filename)