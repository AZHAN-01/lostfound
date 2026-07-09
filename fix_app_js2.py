import re

with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the specific logoutBtn typo
content = content.replace(\"logoutBtn.addEventListener(\click', () => {\", \"logoutBtn.addEventListener('click', () => {\")

# Let's also look for any other obvious syntax errors where we open with backtick and close with single quote
# that isn't fetch (since we fixed fetch earlier)
content = re.sub(r\"\(\([^\']+)'\", r\"('\1'\", content)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(content)
print('Fixed syntax errors')
