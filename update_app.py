import re

def modify_app_js(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Define the API base URL block
    api_base_block = '''// --- API BASE URL CONFIGURATION ---
// Set this to your Render URL when deploying the frontend, e.g., 'https://your-backend.onrender.com'
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'api' 
    : 'https://YOUR_BACKEND_APP.onrender.com/api'; // <--- UPDATE THIS URL AFTER RENDER DEPLOYMENT
// ----------------------------------

'''
    # Prepend the API base URL block if it's not already there
    if 'API_BASE_URL' not in content:
        content = api_base_block + content

    # Replace fetch('api/ with fetch(`${API_BASE_URL}/
    content = re.sub(r"fetch\(\s*'api/", r"fetch(`${API_BASE_URL}/", content)
    
    # Replace fetch(`api/ with fetch(`${API_BASE_URL}/
    content = re.sub(r"fetch\(\s*`api/", r"fetch(`${API_BASE_URL}/", content)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

    print('Successfully updated app.js')

modify_app_js('app.js')
