import re

with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace trailing single quote before comma or parenthesis for the ones starting with backtick
# Pattern: fetch(`${API_BASE_URL}/something', {
# We want to change the ' to `
content = re.sub(r"(fetch\(`\$\{API_BASE_URL\}/[^']+)'", r"\1`", content)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(content)
print('Fixed syntax errors in app.js')
