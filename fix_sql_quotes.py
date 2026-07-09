import os
import re

for file in os.listdir('api'):
    if file.endswith('.php'):
        path = os.path.join('api', file)
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Replace occurrences of "word" that are causing syntax errors
        # Specifically, we know they used to be word. We can find them by looking for patterns like:
        # FROM "table", INTO "table", UPDATE "table"
        # SELECT "col", "col", WHERE "col", AND "col"
        
        # Actually, let's just replace all "word" with word if it's inside a SQL query context
        # A safer bet: we can replace "([a-z_]+)" with \1 ONLY if it is preceded by SQL keywords 
        # like FROM, INTO, UPDATE, SELECT, WHERE, AND, OR, SET, (, ,, = 
        
        # Let's just restore the backticks first? No, we can't easily find which double quotes were backticks.
        # But we know that "users", "documents", "found_items", "certificates", "id", "user_id", "email", "password", "name", "phone", "address" were the columns.
        
        # Let's use a regex that matches common SQL keywords followed by "word"
        content = re.sub(r'(FROM|INTO|UPDATE|JOIN|TABLE)\s+"([a-z_]+)"', r'\1 \2', content, flags=re.IGNORECASE)
        content = re.sub(r'(SELECT|WHERE|AND|OR|SET|BY|ORDER BY)\s+"([a-z_]+)"', r'\1 \2', content, flags=re.IGNORECASE)
        content = re.sub(r'\(\s*"([a-z_]+)"', r'(\1', content)
        content = re.sub(r',\s*"([a-z_]+)"', r', \1', content)
        content = re.sub(r'"([a-z_]+)"\s*=', r'\1 =', content)
        content = re.sub(r'LOWER\("([a-z_]+)"\)', r'LOWER(\1)', content)
        
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)

print('Attempted to fix SQL quotes in PHP files')
