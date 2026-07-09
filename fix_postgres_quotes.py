import os
import re

api_dir = 'api'

for filename in os.listdir(api_dir):
    if filename.endswith('.php'):
        filepath = os.path.join(api_dir, filename)
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Only replace backticks with double quotes if there are backticks
        if '`' in content:
            new_content = re.sub(r'`([^`]+)`', r'"\1"', content)
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f'Updated {filename}')

print('All backticks replaced with double quotes.')
