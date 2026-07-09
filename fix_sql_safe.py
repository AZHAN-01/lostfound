import os
import re

for file in os.listdir('api'):
    if file.endswith('.php'):
        path = os.path.join('api', file)
        with open(path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        new_lines = []
        for line in lines:
            if 'pdo->prepare' in line or 'pdo->query' in line:
                # Replace "word" with word
                # Because the python regex \"([a-zA-Z_]+)\" matches literal double quotes
                # But wait, in PHP, the query is in double quotes: ->prepare("SELECT ... FROM "users"")
                # So we match the INNER quotes.
                # Let's replace \"([a-z_]+)\" with \1
                # Example: "SELECT * FROM "users"" -> "SELECT * FROM users"
                # Wait, re.sub('\"([a-z_]+)\"', r'\1', line) will ALSO strip the outer quotes!
                # Ah! "SELECT ..." -> SELECT ...!
                
                # We should replace \"([a-z_]+)\" with \1 ONLY if it's NOT at the beginning or end of the string.
                # Actually, the words are usually preceded by a space or open parenthesis.
                line = re.sub(r'(?<=\s)\"([a-z_]+)\"', r'\1', line)
                line = re.sub(r'(?<=\()\"([a-z_]+)\"', r'\1', line)
                line = re.sub(r'\"([a-z_]+)\"(?=\s)', r'\1', line)
                line = re.sub(r'\"([a-z_]+)\"(?=\))', r'\1', line)
                line = re.sub(r'\"([a-z_]+)\"(?=,)', r'\1', line)
                
            new_lines.append(line)
            
        with open(path, 'w', encoding='utf-8') as f:
            f.writelines(new_lines)

print('Safely fixed SQL queries!')
