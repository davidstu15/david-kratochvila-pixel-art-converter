from flask import Flask, render_template, send_from_directory
import os

app = Flask(__name__)
# Absolute path to Projects relative to app.py
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECTS_DIR = os.path.join(BASE_DIR, 'Projects')

@app.route('/')
def index():
    if not os.path.exists(PROJECTS_DIR):
        os.makedirs(PROJECTS_DIR)
    
    projects = []
    for folder_name in os.listdir(PROJECTS_DIR):
        folder_path = os.path.join(PROJECTS_DIR, folder_name)
        if os.path.isdir(folder_path):
            projects.append({
                'id': folder_name,
                'name': folder_name.replace('_', ' ')
            })
            
    return render_template('index.html', projects=projects)

# Route to serve the actual project files (HTML, JS, CSS, images, etc.)
@app.route('/Projects/<project_id>/<path:filename>')
def serve_project_file(project_id, filename):
    project_dir = os.path.join(PROJECTS_DIR, project_id)
    return send_from_directory(project_dir, filename)

# Redirect /Projects/<id>/ to the index.html
@app.route('/Projects/<project_id>/')
def project_index(project_id):
    project_dir = os.path.join(PROJECTS_DIR, project_id)
    return send_from_directory(project_dir, 'index.html')

if __name__ == '__main__':
    app.run(debug=True, port=5000)
