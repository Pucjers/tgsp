from flask import Blueprint, send_from_directory, render_template, current_app, redirect, abort
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


@main_bp.route('/broadcaster.html')
def broadcaster():
    """Serve the broadcaster page"""
    return send_from_directory(current_app.template_folder, 'broadcaster.html')


@main_bp.route('/uploads/<path:filename>')
def serve_upload(filename):
    print(f"Upload route triggered for: {filename}")
    upload_folder = current_app.config['UPLOAD_FOLDER']
    print(f"Looking in folder: {upload_folder}")
    print(f"File exists: {os.path.exists(os.path.join(upload_folder, filename))}")
    
    try:
        return send_from_directory(upload_folder, filename)
    except FileNotFoundError:
        return f"File not found: {filename}", 404

@main_bp.route('/<path:filename>')
def static_files(filename):
    print(f"Route triggered for filename: {filename}")
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